import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gte,
  lte,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import { db, type Db, type Tx } from "@/db/client";
import {
  customers,
  orderItems,
  orders,
  products,
  suppliers,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { orderTotals, sumAmounts } from "@/lib/orders";
import type { ReportFilters, ReportKind, ReportRow } from "@/lib/reports";
import { authorize } from "@/services/master-data";

// Reports (SPEC §10), Admin/Manager only. Every report covers the Orders
// dated in the range (both ends included) and leaves out cancelled ones.
// Sums are done in Postgres numeric, so totals match the Order data to the
// paisa; Margin % comes from orderTotals, like everywhere else.

type Deps = { executor?: Db | Tx; today?: string };

type Range = Pick<ReportFilters, "from" | "to">;

type Context = { executor: Db | Tx; range: Range; today: string };

export type Report = { rows: ReportRow[]; totals: ReportRow | null };

// The Orders a report covers.
function counted({ from, to }: Range) {
  return and(
    ne(orders.status, "cancelled"),
    from ? gte(orders.orderDate, from) : undefined,
    to ? lte(orders.orderDate, to) : undefined,
  );
}

const sell = sql<string>`coalesce(sum(${orderItems.sellTotal}), 0)::numeric(14,2)::text`;
const buy = sql<string>`coalesce(sum(${orderItems.buyTotal}), 0)::numeric(14,2)::text`;
// Ordering goes by the numeric sums, not their text.
const bySell = desc(sql`sum(${orderItems.sellTotal})`);
const byBuy = desc(sql`sum(${orderItems.buyTotal})`);
const quantity = sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`;

// Adds Margin and Margin % to a row of sums.
function withMargin<R extends { sell: string; buy: string }>(row: R) {
  const totals = orderTotals([{ sellTotal: row.sell, buyTotal: row.buy }]);
  return { ...row, margin: totals.margin, marginPercent: totals.marginPercent };
}

const total = (rows: readonly ReportRow[], key: string) =>
  rows.reduce((sum, row) => sum + Number(row[key]), 0);

const money = (rows: readonly ReportRow[], key: string) =>
  sumAmounts(rows.map((row) => String(row[key])));

// The totals row under a report with Sell and Buy columns.
function marginTotals(rows: readonly ReportRow[]) {
  return withMargin({ sell: money(rows, "sell"), buy: money(rows, "buy") });
}

async function marginByOrder({ executor, range }: Context): Promise<Report> {
  const rows = await executor
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      customerName: orders.customerName,
      orderDate: orders.orderDate,
      sell,
      buy,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(counted(range))
    .groupBy(orders.id)
    .orderBy(desc(orders.orderDate), desc(orders.year), desc(orders.seq));
  return { rows: rows.map(withMargin), totals: marginTotals(rows) };
}

async function byMonth({ executor, range }: Context): Promise<Report> {
  const month = sql<string>`to_char(${orders.orderDate}, 'YYYY-MM')`;
  const rows = await executor
    .select({
      month,
      orders: countDistinct(orders.id),
      sell,
      buy,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(counted(range))
    .groupBy(month)
    .orderBy(asc(month));
  return {
    rows: rows.map(withMargin),
    totals: { orders: total(rows, "orders"), ...marginTotals(rows) },
  };
}

async function byCustomer({ executor, range }: Context): Promise<Report> {
  const rows = await executor
    .select({
      customerId: customers.id,
      customerName: customers.name,
      orders: countDistinct(orders.id),
      sell,
      buy,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(counted(range))
    .groupBy(customers.id)
    .orderBy(bySell, asc(customers.name));
  return {
    rows: rows.map(withMargin),
    totals: { orders: total(rows, "orders"), ...marginTotals(rows) },
  };
}

// Work Orders are counted through their Items, so a cancelled one (whose
// Items have moved or gone, SPEC §6.2) doesn't count.
async function bySupplier({ executor, range }: Context): Promise<Report> {
  const rows = await executor
    .select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      workOrders: countDistinct(orderItems.workOrderId),
      quantity,
      buy,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(suppliers, eq(suppliers.id, orderItems.supplierId))
    .where(counted(range))
    .groupBy(suppliers.id)
    .orderBy(byBuy, asc(suppliers.name));
  return {
    rows,
    totals: {
      workOrders: total(rows, "workOrders"),
      quantity: total(rows, "quantity"),
      buy: money(rows, "buy"),
    },
  };
}

async function byProduct({ executor, range }: Context): Promise<Report> {
  const rows = await executor
    .select({
      productId: products.id,
      productCode: products.code,
      productName: products.name,
      customerName: customers.name,
      quantity,
      sell,
      buy,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .innerJoin(customers, eq(customers.id, products.customerId))
    .where(counted(range))
    .groupBy(products.id, customers.id)
    .orderBy(bySell, asc(products.name), asc(products.code));
  return {
    rows: rows.map(withMargin),
    totals: { quantity: total(rows, "quantity"), ...marginTotals(rows) },
  };
}

// Age is whole days from the order date to today in Dhaka.
async function openOrders({
  executor,
  range,
  today,
}: Context): Promise<Report> {
  const rows = await executor
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      customerName: orders.customerName,
      orderDate: orders.orderDate,
      status: orders.status,
      ageDays: sql<number>`(${today}::date - ${orders.orderDate})`,
      sell,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(counted(range), notInArray(orders.status, ["completed"])))
    .groupBy(orders.id)
    .orderBy(asc(orders.orderDate), asc(orders.year), asc(orders.seq));
  return { rows, totals: { sell: money(rows, "sell") } };
}

const RUNNERS: Record<ReportKind, (context: Context) => Promise<Report>> = {
  orders: marginByOrder,
  months: byMonth,
  customers: byCustomer,
  suppliers: bySupplier,
  products: byProduct,
  open: openOrders,
};

async function run(
  actor: CurrentUser,
  { report, from, to }: Omit<ReportFilters, "page">,
  { executor = db, today = todayInDhaka() }: Deps = {},
): Promise<Report> {
  authorize(actor, "viewReports");
  return RUNNERS[report]({ executor, range: { from, to }, today });
}

export const reports = { run };
