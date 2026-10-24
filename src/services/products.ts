import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import type { z } from "zod";
import { db, type Db, type Tx } from "@/db/client";
import { customers, products as productsTable, suppliers } from "@/db/schema";
import { withUser } from "@/db/with-user";
import type { CurrentUser } from "@/lib/auth";
import { UserInputError } from "@/lib/errors";
import type { PartyStatus } from "@/lib/parties";
import { can } from "@/lib/permissions";
import {
  duplicateSchema,
  margin,
  productEditSchema,
  productSchema,
  type DuplicateInput,
  type Margin,
  type ProductEditInput,
  type ProductInput,
} from "@/lib/products";
import {
  MASTER_DATA_PAGE_SIZE,
  authorize,
  containing,
  isForeignKeyViolation,
  nextCode,
  parse,
} from "@/services/master-data";

// Products (SPEC §4.3, §4.4). Everyone may read, buy price included (it is on
// the Work Order); Admin and Manager write; only an Admin deletes. Margin is
// computed here and only for roles that may see it, so Staff never receive it
// (SPEC §13.1). Changing prices or Supplier touches only this row: Order Items
// keep their own copies (SPEC §5.3).

type Deps = { executor?: Db | Tx };

const MISSING = "That Product doesn't exist.";

const party = (table: typeof customers | typeof suppliers) => ({
  id: table.id,
  code: table.code,
  name: table.name,
  isActive: table.isActive,
});

function select(executor: Db | Tx) {
  return executor
    .select({
      product: productsTable,
      customer: party(customers),
      supplier: party(suppliers),
    })
    .from(productsTable)
    .innerJoin(customers, eq(customers.id, productsTable.customerId))
    .innerJoin(suppliers, eq(suppliers.id, productsTable.supplierId));
}

type Row = Awaited<ReturnType<typeof select>>[number];

export type ProductView = Row["product"] &
  Pick<Row, "customer" | "supplier"> & { margin: Margin | null };

function view(actor: CurrentUser, { product, customer, supplier }: Row) {
  return {
    ...product,
    customer,
    supplier,
    margin: can(actor.role, "seeMargin")
      ? margin(product.sellPrice, product.buyPrice)
      : null,
  } satisfies ProductView;
}

// A new Product, or a new Supplier on one, must use active records: inactive
// ones are hidden from pickers (SPEC §4.4).
async function requireActive(
  tx: Tx,
  { customerId, supplierId }: { customerId?: string; supplierId?: string },
) {
  const checks = [
    { table: customers, id: customerId, label: "Customer" },
    { table: suppliers, id: supplierId, label: "Supplier" },
  ];
  for (const { table, id, label } of checks) {
    if (!id) continue;
    const [row] = await tx
      .select({ isActive: table.isActive })
      .from(table)
      .where(eq(table.id, id));
    if (!row?.isActive) throw new UserInputError(`Pick an active ${label}.`);
  }
}

type Created = { id: string; code: string };

async function insert(
  tx: Tx,
  actor: CurrentUser,
  values: z.output<typeof productSchema>,
): Promise<Created> {
  const code = await nextCode(tx, "P");
  const [row] = await tx
    .insert(productsTable)
    .values({ ...values, code, createdBy: actor.id })
    .returning({ id: productsTable.id, code: productsTable.code });
  return row!;
}

// SPEC §9: searchable, filterable by Customer and Supplier, 25 per page.
async function list(
  actor: CurrentUser,
  {
    query = "",
    page = 1,
    status = "active",
    customerId,
    supplierId,
  }: {
    query?: string;
    page?: number;
    status?: PartyStatus;
    customerId?: string;
    supplierId?: string;
  },
  { executor = db }: Deps = {},
): Promise<{ rows: ProductView[]; total: number }> {
  const term = containing(query);
  const where = and(
    or(ilike(productsTable.code, term), ilike(productsTable.name, term)),
    status === "all"
      ? undefined
      : eq(productsTable.isActive, status === "active"),
    customerId ? eq(productsTable.customerId, customerId) : undefined,
    supplierId ? eq(productsTable.supplierId, supplierId) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    select(executor)
      .where(where)
      .orderBy(asc(productsTable.name), asc(productsTable.code))
      .limit(MASTER_DATA_PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * MASTER_DATA_PAGE_SIZE),
    executor.select({ total: count() }).from(productsTable).where(where),
  ]);
  return { rows: rows.map((row) => view(actor, row)), total };
}

async function get(
  actor: CurrentUser,
  id: string,
  { executor = db }: Deps = {},
): Promise<ProductView | undefined> {
  const [row] = await select(executor).where(eq(productsTable.id, id));
  return row && view(actor, row);
}

async function create(
  actor: CurrentUser,
  input: ProductInput,
  { executor = db }: Deps = {},
): Promise<Created> {
  authorize(actor, "manageMasterData");
  const values = parse(productSchema, input);
  return withUser(
    actor,
    async (tx) => {
      await requireActive(tx, values);
      return insert(tx, actor, values);
    },
    executor,
  );
}

// Duplicate for another customer (SPEC §4.3): a new Product with the same
// specs and Supplier.
async function duplicate(
  actor: CurrentUser,
  id: string,
  input: DuplicateInput,
  { executor = db }: Deps = {},
): Promise<Created> {
  authorize(actor, "manageMasterData");
  const values = parse(duplicateSchema, input);
  return withUser(
    actor,
    async (tx) => {
      const [row] = await select(tx).where(eq(productsTable.id, id));
      if (!row) throw new UserInputError(MISSING);
      const { product, customer, supplier } = row;
      if (values.customerId === customer.id)
        throw new UserInputError("Pick a different Customer to duplicate for.");
      // The form has no Supplier to pick, so say what to change.
      if (!supplier.isActive)
        throw new UserInputError(
          `${supplier.name} is deactivated. Change this Product's Supplier before duplicating it.`,
        );
      await requireActive(tx, values);
      return insert(tx, actor, {
        ...values,
        supplierId: product.supplierId,
        name: product.name,
        size: product.size,
        thickness: product.thickness,
        colour: product.colour,
        printDetails: product.printDetails,
        description: product.description,
      });
    },
    executor,
  );
}

// Specs, prices and Supplier; the Customer stays. Order Items already copied
// the old values, so only lines added afterwards see the change.
async function update(
  actor: CurrentUser,
  id: string,
  input: ProductEditInput,
  { executor = db }: Deps = {},
): Promise<void> {
  authorize(actor, "manageMasterData");
  const values = parse(productEditSchema, input);
  await withUser(
    actor,
    async (tx) => {
      const [current] = await tx
        .select({ supplierId: productsTable.supplierId })
        .from(productsTable)
        .where(eq(productsTable.id, id));
      if (!current) throw new UserInputError(MISSING);
      if (current.supplierId !== values.supplierId)
        await requireActive(tx, { supplierId: values.supplierId });
      await write(tx, actor, id, values);
    },
    executor,
  );
}

// A deactivated Product is left out of the order form but stays on old
// Orders.
async function setActive(
  actor: CurrentUser,
  id: string,
  isActive: boolean,
  { executor = db }: Deps = {},
): Promise<void> {
  authorize(actor, "manageMasterData");
  await withUser(actor, (tx) => write(tx, actor, id, { isActive }), executor);
}

// Allowed only while no Order Item refers to it (SPEC §4.4); the foreign key
// is the check.
async function remove(
  actor: CurrentUser,
  id: string,
  { executor = db }: Deps = {},
): Promise<void> {
  authorize(actor, "deleteMasterData");
  const record = await get(actor, id, { executor });
  if (!record) throw new UserInputError(MISSING);
  try {
    await withUser(
      actor,
      (tx) => tx.delete(productsTable).where(eq(productsTable.id, id)),
      executor,
    );
  } catch (error) {
    if (!isForeignKeyViolation(error)) throw error;
    throw new UserInputError(
      `${record.code} ${record.name} is in use, so it can't be deleted. Deactivate it instead.`,
    );
  }
}

async function write(
  tx: Tx,
  actor: CurrentUser,
  id: string,
  values: Partial<typeof productsTable.$inferInsert>,
) {
  const updated = await tx
    .update(productsTable)
    .set({ ...values, updatedAt: new Date(), updatedBy: actor.id })
    .where(eq(productsTable.id, id))
    .returning({ id: productsTable.id });
  if (updated.length === 0) throw new UserInputError(MISSING);
}

export const products = {
  list,
  get,
  create,
  duplicate,
  update,
  setActive,
  remove,
};
