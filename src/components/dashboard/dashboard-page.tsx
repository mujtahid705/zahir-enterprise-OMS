import Link from "next/link";
import { Suspense } from "react";
import { CircleCheck } from "lucide-react";
import { SixMonthChart } from "@/components/dashboard/six-month-chart";
import { EmptyState } from "@/components/empty-state";
import {
  NeedsResendBadge,
  StatusPill,
  WoProgressBadge,
} from "@/components/orders/status-pill";
import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser } from "@/lib/auth";
import { NEEDS_ACTION_SHOWN } from "@/lib/dashboard";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUSES,
  orderListHref,
  woProgress,
  type OrderStatus,
} from "@/lib/orders";
import { cn } from "@/lib/utils";
import {
  dashboard,
  type DashboardOverview,
  type NeedsActionGroup,
  type NeedsActionKind,
} from "@/services/dashboard";

// The Dashboard, "Overview" layout (SPEC §10, DESIGN.md §7): numbers first,
// then the chart and Needs action, then the last 10 Orders. Money a role
// may not see never leaves the service.

export function DashboardPage() {
  return (
    <>
      <TopBar title="Dashboard" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <Overview />
        </Suspense>
      </main>
    </>
  );
}

async function Overview() {
  const actor = await getCurrentUser();
  const data = await dashboard.overview(actor);
  const orderCount = ORDER_STATUSES.reduce(
    (sum, status) => sum + data.statusCounts[status],
    0,
  );
  if (orderCount === 0)
    return (
      <EmptyState
        message="No orders yet"
        action={{ label: "Create first order", href: "/orders/new" }}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="section-label">Orders by status</h2>
        <StatusTiles counts={data.statusCounts} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">
          {formatMonth(data.thisMonth.month, "MMMM yyyy")}
        </h2>
        <MonthFigures figures={data.thisMonth} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {data.months && (
          <Card title="Last 6 months" className="self-start lg:col-span-3">
            <SixMonthChart months={data.months} />
          </Card>
        )}
        <NeedsAction
          groups={data.needsAction}
          className={data.months ? "lg:col-span-2" : "lg:col-span-5"}
        />
      </div>

      <Card
        title="Last 10 orders"
        action={
          <Link href="/orders" className="text-sm text-navy hover:underline">
            View all
          </Link>
        }
      >
        <RecentOrders rows={data.recent} />
      </Card>
    </div>
  );
}

function Card({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn("rounded-xl border border-border bg-surface", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <h2 className="section-label">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const DOT: Record<OrderStatus, string> = {
  created: "bg-(--status-created-fg)",
  wo_sent: "bg-(--status-wo-sent-fg)",
  delivered: "bg-(--status-delivered-fg)",
  invoiced: "bg-(--status-invoiced-fg)",
  completed: "bg-(--status-completed-fg)",
  cancelled: "bg-(--status-cancelled-fg)",
};

function StatusTiles({ counts }: { counts: Record<OrderStatus, number> }) {
  return (
    <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-6">
      {ORDER_STATUSES.map((status) => (
        <li key={status}>
          <Link
            href={orderListHref({ query: "", status, page: 1 })}
            className="flex h-full flex-col gap-1 bg-surface px-4 py-3 hover:bg-canvas"
          >
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", DOT[status])}
              />
              {ORDER_STATUS_LABEL[status]}
            </span>
            <span className="text-2xl font-semibold text-navy num">
              {counts[status].toLocaleString("en-IN")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MonthFigures({
  figures,
}: {
  figures: DashboardOverview["thisMonth"];
}) {
  const items: {
    label: string;
    value: string;
    sub?: string;
    brass?: boolean;
  }[] = [
    { label: "Orders", value: figures.orders.toLocaleString("en-IN") },
    { label: "Sell total", value: formatMoney(figures.sell, { whole: true }) },
  ];
  if (figures.buy !== null && figures.margin !== null)
    items.push(
      { label: "Buy total", value: formatMoney(figures.buy, { whole: true }) },
      {
        label: "Margin",
        value: formatMoney(figures.margin, { whole: true }),
        sub: `${figures.marginPercent}% of sell`,
        brass: true,
      },
    );
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border",
        items.length === 4 && "lg:grid-cols-4",
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-4 md:px-5">
          <dt className="section-label">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 text-2xl font-semibold num md:text-[30px] md:leading-9",
              item.brass ? "text-brass" : "text-navy",
            )}
          >
            {item.value}
          </dd>
          {item.sub && (
            <dd className="mt-0.5 text-xs text-ink-muted num">{item.sub}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

// SPEC §10 order, DESIGN.md §7 dots and action links.
const GROUPS: Record<
  NeedsActionKind,
  { title: string; dot: string; action: string }
> = {
  cancelledWorkOrders: {
    title: "Cancelled WOs to tell supplier",
    dot: "bg-danger",
    action: "Open",
  },
  needsResend: { title: "Needs re-send", dot: "bg-warning", action: "Re-send" },
  unsentWorkOrders: {
    title: "Work Orders not sent",
    dot: "bg-border-strong",
    action: "Send",
  },
  toInvoice: {
    title: "Delivered, not invoiced",
    dot: "bg-border-strong",
    action: "Invoice",
  },
  toComplete: {
    title: "Invoiced, not completed",
    dot: "bg-border-strong",
    action: "Open",
  },
};

function NeedsAction({
  groups,
  className,
}: {
  groups: NeedsActionGroup[];
  className?: string;
}) {
  const waiting = groups.filter((group) => group.total > 0);
  const total = waiting.reduce((sum, group) => sum + group.total, 0);
  return (
    <Card title={`Needs action · ${total}`} className={className}>
      {waiting.length === 0 ? (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-ink-muted md:px-5">
          <CircleCheck
            aria-hidden
            className="size-4 text-success"
            strokeWidth={1.5}
          />
          Nothing waiting
        </p>
      ) : (
        <div className="divide-y divide-border pb-2">
          {waiting.map((group) => (
            <ActionGroup key={group.kind} group={group} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ActionGroup({ group }: { group: NeedsActionGroup }) {
  const { title, dot, action } = GROUPS[group.kind];
  const more = group.total - NEEDS_ACTION_SHOWN;
  return (
    <div>
      <div className="flex items-center gap-2 px-4 pt-3 md:px-5">
        <span aria-hidden className={cn("size-2 rounded-full", dot)} />
        <h3 className="text-sm font-medium text-ink">{title}</h3>
        <span className="rounded-full bg-canvas px-2 text-xs text-ink-muted num">
          {group.total}
        </span>
      </div>
      <ul className="mt-1">
        {group.items.map((item) => (
          <li key={`${item.number}-${item.detail}`}>
            <Link
              href={`/orders/${item.orderId}`}
              className="flex items-center gap-3 px-4 py-2 hover:bg-canvas md:px-5"
            >
              <div className="min-w-0 flex-1 pl-4">
                <p className="truncate text-sm text-ink">
                  <span className="font-medium num">{item.number}</span>{" "}
                  <span className="text-ink-muted">· {item.party}</span>
                </p>
                <p className="truncate text-xs text-ink-subtle">
                  {item.detail}
                </p>
              </div>
              <span className="text-sm whitespace-nowrap text-navy">
                {action} →
              </span>
            </Link>
          </li>
        ))}
        {more > 0 && (
          <li className="px-4 py-2 pl-8 text-xs text-ink-muted md:px-5 md:pl-9">
            +{more} more
          </li>
        )}
      </ul>
    </div>
  );
}

function RecentOrders({ rows }: { rows: DashboardOverview["recent"] }) {
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="bg-canvas text-left">
            <th className="px-5 py-2.5 section-label">Order</th>
            <th className="px-3 py-2.5 section-label">Customer</th>
            <th className="px-3 py-2.5 section-label">Date</th>
            <th className="px-3 py-2.5 section-label">Status</th>
            <th className="px-5 py-2.5 text-right section-label">Sell</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const progress = woProgress(row.workOrders);
            return (
              <tr
                key={row.id}
                className="h-11 border-t border-border hover:bg-canvas"
              >
                <td className="px-5">
                  <Link
                    href={`/orders/${row.id}`}
                    className="font-medium whitespace-nowrap text-navy num hover:underline"
                  >
                    {row.orderNo}
                  </Link>
                </td>
                <td className="px-3 text-ink">{row.customerName}</td>
                <td className="px-3 whitespace-nowrap text-ink-muted">
                  {formatDate(row.orderDate)}
                </td>
                <td className="px-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusPill status={row.status} />
                    {progress && <WoProgressBadge label={progress} />}
                    {row.needsResend && <NeedsResendBadge />}
                  </span>
                </td>
                <td className="px-5 text-right whitespace-nowrap text-ink num">
                  {formatMoney(row.sellTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/orders/${row.id}`}
              className="flex flex-col gap-1 px-4 py-3"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-navy num">{row.orderNo}</span>
                <StatusPill status={row.status} />
              </span>
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink-muted">
                  {row.customerName}
                </span>
                <span className="whitespace-nowrap text-ink num">
                  {formatMoney(row.sellTotal)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
