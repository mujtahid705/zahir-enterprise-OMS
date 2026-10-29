import { and, asc, count, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { db, type Db, type Tx } from "@/db/client";
import { orderItems, orders, workOrders } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { NEEDS_ACTION_SHOWN, lastMonths } from "@/lib/dashboard";
import { formatDate, todayInDhaka } from "@/lib/dates";
import { ORDER_STATUSES, orderTotals, type OrderStatus } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { orders as orderService } from "@/services/orders";

// The Dashboard (SPEC §10, DESIGN.md §7): every role sees it. Buy totals and
// Margin are left out for roles that may not see Margin (SPEC §13.1). Month
// figures leave out cancelled Orders, like Reports.

type Deps = { executor?: Db | Tx; today?: string };

export type NeedsActionKind =
  | "cancelledWorkOrders"
  | "needsResend"
  | "unsentWorkOrders"
  | "toInvoice"
  | "toComplete";

export type NeedsActionItem = {
  orderId: string;
  number: string;
  party: string;
  detail: string;
};

export type NeedsActionGroup = {
  kind: NeedsActionKind;
  total: number;
  items: NeedsActionItem[];
};

async function statusCounts(executor: Db | Tx) {
  const rows = await executor
    .select({ status: orders.status, total: count() })
    .from(orders)
    .groupBy(orders.status);
  const counts = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<OrderStatus, number>;
  for (const row of rows) counts[row.status] = row.total;
  return counts;
}

// Orders, Sell and Buy per month for the months shown, zero-filled.
async function monthTotals(executor: Db | Tx, months: string[]) {
  const month = sql<string>`to_char(${orders.orderDate}, 'YYYY-MM')`;
  const rows = await executor
    .select({
      month,
      orders: sql<number>`count(distinct ${orders.id})::int`,
      sell: sql<string>`coalesce(sum(${orderItems.sellTotal}), 0)::text`,
      buy: sql<string>`coalesce(sum(${orderItems.buyTotal}), 0)::text`,
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(
      and(
        ne(orders.status, "cancelled"),
        gte(orders.orderDate, `${months[0]}-01`),
        lt(
          orders.orderDate,
          sql`${`${months.at(-1)}-01`}::date + interval '1 month'`,
        ),
      ),
    )
    .groupBy(month);
  return months.map((m) => {
    const row = rows.find((r) => r.month === m);
    const totals = orderTotals([
      { sellTotal: row?.sell ?? "0", buyTotal: row?.buy ?? "0" },
    ]);
    return { month: m, orders: row?.orders ?? 0, ...totals };
  });
}

// Oldest Order first, so what has waited longest leads.
const oldestFirst = [asc(orders.orderDate), asc(orders.year), asc(orders.seq)];
// Every matching row's count rides along with the few that are shown.
const total = sql<number>`(count(*) over ())::int`;

type Row = { orderId: string; number: string; party: string; total: number };

const item = (
  { orderId, number, party }: Row,
  detail: string,
): NeedsActionItem => ({ orderId, number, party, detail });

const group = <R extends Row>(
  kind: NeedsActionKind,
  rows: R[],
  detail: (row: R) => string,
): NeedsActionGroup => ({
  kind,
  total: rows[0]?.total ?? 0,
  items: rows.map((row) => item(row, detail(row))),
});

function workOrderRows(executor: Db | Tx, where: ReturnType<typeof and>) {
  return executor
    .select({
      orderId: orders.id,
      number: workOrders.woNo,
      party: workOrders.supplierName,
      orderNo: orders.orderNo,
      customerName: orders.customerName,
      cancelledAt: workOrders.cancelledAt,
      total,
    })
    .from(workOrders)
    .innerJoin(orders, eq(orders.id, workOrders.orderId))
    .where(where)
    .orderBy(...oldestFirst, asc(workOrders.letter))
    .limit(NEEDS_ACTION_SHOWN);
}

function orderRows(executor: Db | Tx, where: ReturnType<typeof and>) {
  return executor
    .select({
      orderId: orders.id,
      number: orders.orderNo,
      party: orders.customerName,
      orderDate: orders.orderDate,
      challanNo: orders.challanNo,
      invoiceDate: orders.invoiceDate,
      total,
    })
    .from(orders)
    .where(where)
    .orderBy(...oldestFirst)
    .limit(NEEDS_ACTION_SHOWN);
}

const days = (from: string, to: string) => {
  const n = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return `${n} ${n === 1 ? "day" : "days"}`;
};

// SPEC §10 "Orders needing action", in its order, each with its first few
// items. Cancelling an Order cancels its sent Work Orders and deletes the
// rest (SPEC §6.2), so only live Orders are checked for unsent ones.
async function needsAction(
  executor: Db | Tx,
  today: string,
): Promise<NeedsActionGroup[]> {
  const live = ne(orders.status, "cancelled");
  const [cancelled, resendWos, resendChallans, unsent, toInvoice, toComplete] =
    await Promise.all([
      workOrderRows(
        executor,
        and(
          eq(workOrders.status, "cancelled"),
          isNull(workOrders.cancelAcknowledgedAt),
        ),
      ),
      workOrderRows(
        executor,
        and(
          live,
          eq(workOrders.status, "sent"),
          eq(workOrders.needsResend, true),
        ),
      ),
      orderRows(executor, and(live, eq(orders.challanNeedsResend, true))),
      workOrderRows(executor, and(live, eq(workOrders.status, "pending"))),
      orderRows(executor, eq(orders.status, "delivered")),
      orderRows(executor, eq(orders.status, "invoiced")),
    ]);
  const shown = (date: Date | string) =>
    formatDate(typeof date === "string" ? date : todayInDhaka(date));
  return [
    group(
      "cancelledWorkOrders",
      cancelled,
      (wo) => `Cancelled ${shown(wo.cancelledAt!)}`,
    ),
    // Work Orders before Challans; an Order is no older than its own Challan.
    {
      kind: "needsResend",
      total: (resendWos[0]?.total ?? 0) + (resendChallans[0]?.total ?? 0),
      items: [
        ...resendWos.map((wo) => item(wo, "Work Order")),
        ...resendChallans.map((order) =>
          item({ ...order, number: order.challanNo }, "Challan"),
        ),
      ].slice(0, NEEDS_ACTION_SHOWN),
    },
    group(
      "unsentWorkOrders",
      unsent,
      (wo) => `${wo.orderNo} · ${wo.customerName}`,
    ),
    group(
      "toInvoice",
      toInvoice,
      (order) => `Ordered ${shown(order.orderDate)}`,
    ),
    group("toComplete", toComplete, (order) =>
      order.invoiceDate
        ? `Invoiced ${shown(order.invoiceDate)} · ${days(order.invoiceDate, today)}`
        : `Ordered ${shown(order.orderDate)}`,
    ),
  ];
}

async function overview(
  actor: CurrentUser,
  { executor = db, today = todayInDhaka() }: Deps = {},
) {
  const months = lastMonths(today);
  // One read-only transaction: a single pooled connection for the dozen
  // queries, rather than one each, and every figure from the same snapshot.
  const [counts, totals, actions, recent] = await executor.transaction(
    (tx) =>
      Promise.all([
        statusCounts(tx),
        monthTotals(tx, months),
        needsAction(tx, today),
        orderService.list(actor, {}, { executor: tx }),
      ]),
    { accessMode: "read only" },
  );
  const seesMargin = can(actor.role, "seeMargin");
  const current = totals.at(-1)!;
  return {
    statusCounts: counts,
    thisMonth: {
      month: current.month,
      orders: current.orders,
      sell: current.sell,
      buy: seesMargin ? current.buy : null,
      margin: seesMargin ? current.margin : null,
      marginPercent: seesMargin ? current.marginPercent : null,
    },
    months: seesMargin
      ? totals.map(({ month, sell, buy, margin }) => ({
          month,
          sell,
          buy,
          margin,
        }))
      : null,
    needsAction: actions,
    recent: recent.rows.slice(0, 10),
  };
}

export type DashboardOverview = Awaited<ReturnType<typeof overview>>;

export const dashboard = { overview };
