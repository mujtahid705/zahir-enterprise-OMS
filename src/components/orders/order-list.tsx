import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  NeedsResendBadge,
  ORDER_STATUS_LABEL,
  StatusPill,
  WoProgressBadge,
} from "@/components/orders/status-pill";
import { Pager } from "@/components/pager";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  ORDER_STATUSES,
  orderListFilters,
  orderListHref,
  woProgress,
} from "@/lib/orders";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { orders } from "@/services/orders";
import { customers, suppliers } from "@/services/parties";
import { MASTER_DATA_PAGE_SIZE } from "@/services/master-data";

// The Order list (SPEC §9 /orders): search, filters in the URL, 25 per page,
// stacked cards on phones. Margin arrives only for roles that may see it.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function OrderListPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <TopBar title="Orders" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <OrderList searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function OrderList({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getCurrentUser();
  const filters = orderListFilters(await searchParams);
  const [{ rows, total }, customerOptions, supplierOptions] = await Promise.all(
    [
      orders.list(actor, filters),
      customers.options(actor),
      suppliers.options(actor),
    ],
  );
  const pages = Math.max(1, Math.ceil(total / MASTER_DATA_PAGE_SIZE));
  const seesMargin = can(actor.role, "seeMargin");
  const filtered = orderListHref({ ...filters, page: 1 }) !== "/orders";

  if (total === 0 && !filtered) {
    return (
      <EmptyState
        message="No orders yet"
        action={{ label: "Create first order", href: "/orders/new" }}
      />
    );
  }

  const money = "num whitespace-nowrap md:px-4 md:text-right";
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          role="search"
          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto]"
        >
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Label htmlFor="q" className="sr-only">
              Search Orders
            </Label>
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search number, customer or reference"
            />
          </div>
          <Label htmlFor="status" className="sr-only">
            Status
          </Label>
          <NativeSelect
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABEL[status]}
              </option>
            ))}
          </NativeSelect>
          <Label htmlFor="customer" className="sr-only">
            Customer
          </Label>
          <NativeSelect
            id="customer"
            name="customer"
            defaultValue={filters.customerId ?? ""}
          >
            <option value="">All customers</option>
            {customerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
          <Label htmlFor="supplier" className="sr-only">
            Supplier
          </Label>
          <NativeSelect
            id="supplier"
            name="supplier"
            defaultValue={filters.supplierId ?? ""}
          >
            <option value="">All suppliers</option>
            {supplierOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
          <div className="flex items-center gap-2">
            <Label htmlFor="from" className="text-xs text-ink-muted">
              <span className="sr-only">Ordered </span>From
            </Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="to" className="text-xs text-ink-muted">
              <span className="sr-only">Ordered </span>To
            </Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to} />
          </div>
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
        <div className="flex items-center gap-3">
          {filtered && (
            <Link
              href="/orders"
              className="text-sm text-ink-muted hover:text-navy"
            >
              Clear filters
            </Link>
          )}
          <Button asChild>
            <Link href="/orders/new">
              <Plus strokeWidth={1.5} />
              New Order
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="hidden bg-canvas md:table-header-group">
            <tr className="border-b border-border-strong text-left">
              <th className="px-4 py-3 section-label">Order</th>
              <th className="px-4 py-3 section-label">Customer</th>
              <th className="px-4 py-3 section-label">Date</th>
              <th className="px-4 py-3 section-label">Status</th>
              <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                Sell total
              </th>
              {seesMargin && (
                <th className="px-4 py-3 text-right section-label">Margin</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const progress = woProgress(row.workOrders);
              return (
                <tr
                  key={row.id}
                  className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-border px-4 py-3 last:border-b-0 md:table-row md:h-11 md:p-0"
                >
                  <td className="md:px-4">
                    <Link
                      href={`/orders/${row.id}`}
                      className="font-medium whitespace-nowrap text-navy num hover:underline"
                    >
                      {row.orderNo}
                    </Link>
                  </td>
                  <td className="col-start-1 row-start-2 text-ink-muted md:px-4 md:text-ink">
                    {row.customerName}
                    {row.customerRef && (
                      <span className="text-ink-muted">
                        {" "}
                        · {row.customerRef}
                      </span>
                    )}
                  </td>
                  <td className="col-start-1 row-start-3 text-xs whitespace-nowrap text-ink-muted md:px-4 md:text-sm md:text-ink">
                    {formatDate(row.orderDate)}
                  </td>
                  <td className="col-start-2 row-start-1 md:px-4">
                    <div className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
                      <StatusPill status={row.status} />
                      {progress && <WoProgressBadge label={progress} />}
                      {row.needsResend && <NeedsResendBadge />}
                    </div>
                  </td>
                  <td
                    className={cn(money, "col-start-2 row-start-2 text-right")}
                  >
                    {formatMoney(row.sellTotal)}
                  </td>
                  {row.margin && (
                    <td
                      className={cn(
                        money,
                        "col-start-2 row-start-3 text-right text-xs md:text-sm",
                        row.margin.percent < 0 && "text-danger",
                      )}
                    >
                      <span className="text-ink-muted md:hidden">Margin </span>
                      {formatMoney(row.margin.amount)}{" "}
                      <span className="text-xs">({row.margin.percent}%)</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-ink-muted">
            {filters.query
              ? `No orders match “${filters.query}”.`
              : "No orders match these filters."}
          </p>
        )}
      </div>

      <Pager
        page={filters.page}
        pages={pages}
        total={total}
        noun="Orders"
        href={(page) => orderListHref({ ...filters, page })}
      />
    </section>
  );
}
