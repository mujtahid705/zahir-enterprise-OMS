import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import { db, type Db, type Tx } from "@/db/client";
import {
  customers as customersTable,
  suppliers as suppliersTable,
} from "@/db/schema";
import { withUser } from "@/db/with-user";
import type { CurrentUser } from "@/lib/auth";
import { UserInputError } from "@/lib/errors";
import {
  PARTY,
  type PartyInput,
  type PartyKind,
  type PartyStatus,
} from "@/lib/parties";
import {
  MASTER_DATA_PAGE_SIZE,
  authorize,
  containing,
  isForeignKeyViolation,
  nextCode,
  parse,
} from "@/services/master-data";

// Customers and Suppliers (SPEC §4.1, §4.2, §4.4). Everyone may read; Admin
// and Manager write; only an Admin deletes. Every function checks the acting
// User's role itself, so a Server Action can't skip it.

type Deps = { executor?: Db | Tx };

export const PARTIES_PAGE_SIZE = MASTER_DATA_PAGE_SIZE;

// Both tables have the same columns (Supplier WhatsApp is only NOT NULL), so
// one query shape serves both.
const TABLES = {
  customer: customersTable,
  supplier: suppliersTable as unknown as typeof customersTable,
};

function parties(kind: PartyKind) {
  const { prefix, label, schema } = PARTY[kind];
  const table = TABLES[kind];
  const missing = `That ${label} doesn't exist.`;

  // SPEC §9: every list is searchable and paginated, 25 per page.
  async function list(
    _actor: CurrentUser,
    {
      query = "",
      page = 1,
      status = "active",
    }: { query?: string; page?: number; status?: PartyStatus },
    { executor = db }: Deps = {},
  ) {
    const term = containing(query);
    const where = and(
      or(
        ilike(table.code, term),
        ilike(table.name, term),
        ilike(table.phone, term),
      ),
      status === "all" ? undefined : eq(table.isActive, status === "active"),
    );
    const [rows, [{ total }]] = await Promise.all([
      executor
        .select()
        .from(table)
        .where(where)
        .orderBy(asc(table.name), asc(table.code))
        .limit(PARTIES_PAGE_SIZE)
        .offset((Math.max(1, page) - 1) * PARTIES_PAGE_SIZE),
      executor.select({ total: count() }).from(table).where(where),
    ]);
    return { rows, total };
  }

  // For pickers: active records only (SPEC §4.4).
  async function options(_actor: CurrentUser, { executor = db }: Deps = {}) {
    return executor
      .select({ id: table.id, code: table.code, name: table.name })
      .from(table)
      .where(eq(table.isActive, true))
      .orderBy(asc(table.name), asc(table.code));
  }

  async function get(
    _actor: CurrentUser,
    id: string,
    { executor = db }: Deps = {},
  ) {
    const [row] = await executor.select().from(table).where(eq(table.id, id));
    return row;
  }

  async function create(
    actor: CurrentUser,
    input: PartyInput,
    { executor = db }: Deps = {},
  ): Promise<{ id: string; code: string }> {
    authorize(actor, "manageMasterData");
    const values = parse(schema, input);
    return withUser(
      actor,
      async (tx) => {
        const code = await nextCode(tx, prefix);
        const [row] = await tx
          .insert(table)
          .values({ ...values, code, createdBy: actor.id })
          .returning({ id: table.id, code: table.code });
        return row!;
      },
      executor,
    );
  }

  async function update(
    actor: CurrentUser,
    id: string,
    input: PartyInput,
    { executor = db }: Deps = {},
  ): Promise<void> {
    authorize(actor, "manageMasterData");
    await write(actor, id, parse(schema, input), executor);
  }

  // A deactivated record is left out of pickers but stays on old Orders.
  async function setActive(
    actor: CurrentUser,
    id: string,
    isActive: boolean,
    { executor = db }: Deps = {},
  ): Promise<void> {
    authorize(actor, "manageMasterData");
    await write(actor, id, { isActive }, executor);
  }

  // Allowed only while nothing refers to the record (SPEC §4.4). Orders (and
  // Products) reference it without ON DELETE CASCADE, so the foreign key is
  // the check and a race can't slip past it.
  async function remove(
    actor: CurrentUser,
    id: string,
    { executor = db }: Deps = {},
  ): Promise<void> {
    authorize(actor, "deleteMasterData");
    const record = await get(actor, id, { executor });
    if (!record) throw new UserInputError(missing);
    try {
      await withUser(
        actor,
        (tx) => tx.delete(table).where(eq(table.id, id)),
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
    actor: CurrentUser,
    id: string,
    values: Partial<typeof table.$inferInsert>,
    executor: Db | Tx,
  ) {
    const updated = await withUser(
      actor,
      (tx) =>
        tx
          .update(table)
          .set({ ...values, updatedAt: new Date(), updatedBy: actor.id })
          .where(eq(table.id, id))
          .returning({ id: table.id }),
      executor,
    );
    if (updated.length === 0) throw new UserInputError(missing);
  }

  return { list, options, get, create, update, setActive, remove };
}

export const customers = parties("customer");
export const suppliers = parties("supplier");

export const PARTY_SERVICES = { customer: customers, supplier: suppliers };
