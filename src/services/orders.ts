import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db, type Db, type Tx } from "@/db/client";
import {
  companySettings,
  customers,
  numberSequences,
  orderItems,
  orders as ordersTable,
  products,
  suppliers,
  workOrders,
} from "@/db/schema";
import { withUser } from "@/db/with-user";
import type { CurrentUser } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { UserInputError } from "@/lib/errors";
import { orderNumbers, workOrderNo } from "@/lib/numbering";
import {
  orderSchema,
  orderTotals,
  specText,
  splitWorkOrders,
  type OrderInput,
  type OrderListFilters,
} from "@/lib/orders";
import { can } from "@/lib/permissions";
import {
  MASTER_DATA_PAGE_SIZE,
  authorize,
  containing,
  parse,
} from "@/services/master-data";

// Orders (SPEC §5, §7). Every role may create and read them. Saving copies
// the Customer, each Product and each Supplier onto the Order, so later
// master data changes never reach it (SPEC §5.3). Buy totals and Margin are
// left out for roles that may not see Margin (SPEC §13.1).

type Deps = { executor?: Db | Tx };

// Takes the next number in the year's sequence (SPEC §7, §14
// number_sequences). The row lock makes a concurrent save wait for this
// transaction, so two Orders never share a number; a rolled-back save hands
// its number to the next one.
async function nextSeq(tx: Tx, year: number): Promise<number> {
  const [{ value }] = await tx
    .insert(numberSequences)
    .values({ year, lastValue: 1 })
    .onConflictDoUpdate({
      target: numberSequences.year,
      set: { lastValue: sql`${numberSequences.lastValue} + 1` },
    })
    .returning({ value: numberSequences.lastValue });
  return value;
}

// The Products the form offers (SPEC §5.2): this Customer's active Products
// whose Supplier is active too.
function pickable(executor: Db | Tx, customerId: string) {
  return executor
    .select({
      id: products.id,
      code: products.code,
      name: products.name,
      size: products.size,
      thickness: products.thickness,
      colour: products.colour,
      printDetails: products.printDetails,
      sellPrice: products.sellPrice,
      buyPrice: products.buyPrice,
      supplier: {
        id: suppliers.id,
        name: suppliers.name,
        phone: suppliers.phone,
        address: suppliers.address,
      },
    })
    .from(products)
    .innerJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(
      and(
        eq(products.customerId, customerId),
        eq(products.isActive, true),
        eq(suppliers.isActive, true),
      ),
    )
    .orderBy(asc(products.name), asc(products.code));
}

// Step 1 of the order form: active Customers, with the address that
// becomes the default delivery address.
async function customerOptions(
  _actor: CurrentUser,
  { executor = db }: Deps = {},
) {
  return executor
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      phone: customers.phone,
      address: customers.address,
    })
    .from(customers)
    .where(eq(customers.isActive, true))
    .orderBy(asc(customers.name), asc(customers.code));
}

export type CustomerOption = Awaited<
  ReturnType<typeof customerOptions>
>[number];

// Step 2's product sheet. Buy prices are on the Work Order, so every role
// may see them; Margin is worked out in the browser only for those who may
// see it.
async function productOptions(
  _actor: CurrentUser,
  customerId: string,
  { executor = db }: Deps = {},
) {
  const rows = await pickable(executor, customerId);
  return rows.map(({ supplier, ...product }) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    specText: specText(product),
    sellPrice: product.sellPrice,
    buyPrice: product.buyPrice,
    supplier: { id: supplier.id, name: supplier.name },
  }));
}

export type ProductOption = Awaited<ReturnType<typeof productOptions>>[number];

// Saves a new Order in one transaction (SPEC §5.2): number, Customer and
// Product snapshots, and one Work Order per Supplier.
async function create(
  actor: CurrentUser,
  input: OrderInput,
  { executor = db }: Deps = {},
): Promise<{ id: string; orderNo: string }> {
  authorize(actor, "editOrders");
  const values = parse(orderSchema, input);
  if (values.items.some((item) => item.sellPrice || item.buyPrice))
    authorize(actor, "overridePrices");
  return withUser(
    actor,
    async (tx) => {
      const [customer] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, values.customerId));
      if (!customer?.isActive)
        throw new UserInputError("Pick an active Customer.");

      const offered = new Map(
        (await pickable(tx, customer.id)).map((row) => [row.id, row]),
      );
      const lines = values.items.map((item) => {
        const product = offered.get(item.productId);
        if (!product)
          throw new UserInputError(
            "A Product on this Order is no longer offered for this Customer. Remove it and try again.",
          );
        return { ...item, product, supplierId: product.supplier.id };
      });

      const year = Number(todayInDhaka().slice(0, 4));
      const seq = await nextSeq(tx, year);
      const [order] = await tx
        .insert(ordersTable)
        .values({
          ...orderNumbers(year, seq),
          year,
          seq,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          deliveryAddress: values.deliveryAddress ?? customer.address,
          orderDate: values.orderDate,
          deliveryDate: values.deliveryDate,
          customerRef: values.customerRef,
          notes: values.notes,
          invoiceNote: values.invoiceNote,
          createdBy: actor.id,
        })
        .returning({ id: ordersTable.id, orderNo: ordersTable.orderNo });

      const settings = await tx
        .select({ note: companySettings.defaultWoNote })
        .from(companySettings);
      const groups = splitWorkOrders(lines);
      const created = await tx
        .insert(workOrders)
        .values(
          groups.map(({ letter, lines: [{ product }] }) => ({
            orderId: order!.id,
            supplierId: product.supplier.id,
            letter,
            woNo: workOrderNo(year, seq, letter),
            supplierName: product.supplier.name,
            supplierPhone: product.supplier.phone,
            supplierAddress: product.supplier.address,
            note: settings[0]?.note ?? null,
          })),
        )
        .returning({ id: workOrders.id, supplierId: workOrders.supplierId });
      const woFor = new Map(created.map((wo) => [wo.supplierId, wo.id]));

      const items = await tx
        .insert(orderItems)
        .values(
          lines.map(({ product, quantity, supplierId }, index) => ({
            orderId: order!.id,
            workOrderId: woFor.get(supplierId)!,
            productId: product.id,
            supplierId,
            productName: product.name,
            specText: specText(product),
            quantity,
            sellPrice: product.sellPrice,
            buyPrice: product.buyPrice,
            sortOrder: index,
          })),
        )
        .returning({ id: orderItems.id, productId: orderItems.productId });
      const itemFor = new Map(items.map((item) => [item.productId, item.id]));

      // An override is written over the Product's copy, so the Activity Log
      // shows it as a before → after change (SPEC §11.1).
      for (const { product, sellPrice, buyPrice } of lines) {
        const set = {
          ...(sellPrice && sellPrice !== product.sellPrice && { sellPrice }),
          ...(buyPrice && buyPrice !== product.buyPrice && { buyPrice }),
        };
        if (Object.keys(set).length)
          await tx
            .update(orderItems)
            .set(set)
            .where(eq(orderItems.id, itemFor.get(product.id)!));
      }
      return order!;
    },
    executor,
  );
}

async function get(
  actor: CurrentUser,
  id: string,
  { executor = db }: Deps = {},
) {
  const [order] = await executor
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id));
  if (!order) return undefined;
  const [items, wos] = await Promise.all([
    executor
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.sortOrder)),
    executor
      .select()
      .from(workOrders)
      .where(eq(workOrders.orderId, id))
      .orderBy(asc(workOrders.letter)),
  ]);
  const lines = items.map((item) => ({
    ...item,
    sellTotal: item.sellTotal!,
    buyTotal: item.buyTotal!,
  }));
  const seesMargin = can(actor.role, "seeMargin");
  const totals = orderTotals(lines);
  return {
    ...order,
    items: lines.map((line) => ({
      ...line,
      buyTotal: seesMargin ? line.buyTotal : null,
    })),
    workOrders: wos.map((wo) => {
      const its = lines.filter((line) => line.workOrderId === wo.id);
      return {
        ...wo,
        itemCount: its.length,
        quantity: its.reduce((sum, line) => sum + line.quantity, 0),
      };
    }),
    totals: seesMargin
      ? totals
      : { sell: totals.sell, buy: null, margin: null, marginPercent: null },
  };
}

export type OrderView = NonNullable<Awaited<ReturnType<typeof get>>>;

// Per-Order figures for the list, grouped once and joined on. Cancelled
// Work Orders don't count towards WO x/y (SPEC §6.1), and only a sent one
// can need re-sending (SPEC §6.2).
function summaries(executor: Db | Tx) {
  const items = executor
    .select({
      orderId: orderItems.orderId,
      sell: sql<string>`sum(${orderItems.sellTotal})`.as("sell"),
      buy: sql<string>`sum(${orderItems.buyTotal})`.as("buy"),
    })
    .from(orderItems)
    .groupBy(orderItems.orderId)
    .as("item_totals");
  const wos = executor
    .select({
      orderId: workOrders.orderId,
      sent: sql<number>`(count(*) filter (where ${workOrders.status} = 'sent'))::int`.as(
        "wo_sent",
      ),
      open: sql<number>`(count(*) filter (where ${workOrders.status} <> 'cancelled'))::int`.as(
        "wo_open",
      ),
      needsResend:
        sql<boolean>`bool_or(${workOrders.needsResend} and ${workOrders.status} = 'sent')`.as(
          "wo_needs_resend",
        ),
    })
    .from(workOrders)
    .groupBy(workOrders.orderId)
    .as("wo_counts");
  return { items, wos };
}

export type OrderFilters = Partial<OrderListFilters>;

// The Order list (SPEC §9 /orders): newest first, 25 per page.
async function list(
  actor: CurrentUser,
  {
    query = "",
    status,
    customerId,
    supplierId,
    from,
    to,
    page = 1,
  }: OrderFilters,
  { executor = db }: Deps = {},
) {
  const { items, wos } = summaries(executor);
  const term = containing(query);
  const where = and(
    or(
      ilike(ordersTable.orderNo, term),
      ilike(ordersTable.customerName, term),
      ilike(ordersTable.customerRef, term),
    ),
    status ? eq(ordersTable.status, status) : undefined,
    customerId ? eq(ordersTable.customerId, customerId) : undefined,
    supplierId
      ? inArray(
          ordersTable.id,
          executor
            .select({ orderId: orderItems.orderId })
            .from(orderItems)
            .where(eq(orderItems.supplierId, supplierId)),
        )
      : undefined,
    from ? gte(ordersTable.orderDate, from) : undefined,
    to ? lte(ordersTable.orderDate, to) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    executor
      .select({
        id: ordersTable.id,
        orderNo: ordersTable.orderNo,
        customerId: ordersTable.customerId,
        customerName: ordersTable.customerName,
        customerRef: ordersTable.customerRef,
        orderDate: ordersTable.orderDate,
        status: ordersTable.status,
        sell: sql<string>`coalesce(${items.sell}, 0)`,
        buy: sql<string>`coalesce(${items.buy}, 0)`,
        woSent: sql<number>`coalesce(${wos.sent}, 0)`,
        woTotal: sql<number>`coalesce(${wos.open}, 0)`,
        needsResend: sql<boolean>`(coalesce(${wos.needsResend}, false) or ${ordersTable.challanNeedsResend})`,
      })
      .from(ordersTable)
      // Left joins: an Order whose pending Work Orders were deleted on
      // cancel (SPEC §6.2) still belongs in the list and its count.
      .leftJoin(items, eq(items.orderId, ordersTable.id))
      .leftJoin(wos, eq(wos.orderId, ordersTable.id))
      .where(where)
      .orderBy(desc(ordersTable.year), desc(ordersTable.seq))
      .limit(MASTER_DATA_PAGE_SIZE)
      .offset((Math.max(1, page) - 1) * MASTER_DATA_PAGE_SIZE),
    executor.select({ total: count() }).from(ordersTable).where(where),
  ]);
  const seesMargin = can(actor.role, "seeMargin");
  return {
    total,
    rows: rows.map(({ sell, buy, woSent, woTotal, ...order }) => {
      const totals = orderTotals([{ sellTotal: sell, buyTotal: buy }]);
      return {
        ...order,
        workOrders: { sent: woSent, total: woTotal },
        sellTotal: totals.sell,
        margin: seesMargin
          ? { amount: totals.margin, percent: totals.marginPercent }
          : null,
      };
    }),
  };
}

export const orders = {
  customerOptions,
  productOptions,
  create,
  get,
  list,
};
