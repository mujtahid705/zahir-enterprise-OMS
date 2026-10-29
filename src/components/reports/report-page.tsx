import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { StatusPill } from "@/components/orders/status-pill";
import { Pager } from "@/components/pager";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatMoney, formatPieces } from "@/lib/money";
import type { OrderStatus } from "@/lib/orders";
import {
  REPORTS,
  REPORT_KINDS,
  reportFilters,
  reportHref,
  type Column,
  type ReportFilters,
  type ReportRow,
} from "@/lib/reports";
import { cn } from "@/lib/utils";
import { MASTER_DATA_PAGE_SIZE } from "@/services/master-data";
import { reports } from "@/services/reports";

// Reports (SPEC §10): one tab per report, an order date range kept in the
// URL, 25 lines per page with the whole range's totals underneath, and a
// CSV export of the same report and range. Admin/Manager only: the layout
// gates the page and the service refuses anyone else.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function ReportPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <TopBar title="Reports" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <Report searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Report({ searchParams }: { searchParams: SearchParams }) {
  const actor = await getCurrentUser();
  const filters = reportFilters(await searchParams);
  const { rows, totals } = await reports.run(actor, filters);
  const { title, columns } = REPORTS[filters.report];
  const pages = Math.max(1, Math.ceil(rows.length / MASTER_DATA_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const shown = rows.slice(
    (page - 1) * MASTER_DATA_PAGE_SIZE,
    page * MASTER_DATA_PAGE_SIZE,
  );
  const ranged = Boolean(filters.from || filters.to);

  return (
    <section className="flex flex-col gap-4">
      <ReportTabs filters={filters} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          role="search"
          aria-label="Order date range"
          className="flex flex-wrap items-center gap-2"
        >
          {filters.report !== "orders" && (
            <input type="hidden" name="report" value={filters.report} />
          )}
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
            Apply
          </Button>
          {ranged && (
            <Link
              href={reportHref({ report: filters.report, page: 1 })}
              className="text-sm text-ink-muted hover:text-navy"
            >
              All dates
            </Link>
          )}
        </form>
        <Button asChild variant="outline">
          {/* A plain link: the route answers with a file to save. */}
          <a href={reportHref(filters, "/reports/export")} download>
            <Download strokeWidth={1.5} />
            Export CSV
          </a>
        </Button>
      </div>

      <p className="text-sm text-ink-muted">
        {title} · Orders dated {rangeText(filters)}, cancelled Orders left out.
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="hidden bg-canvas md:table-header-group">
            <tr className="border-b border-border-strong text-left">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 section-label whitespace-nowrap",
                    numeric(column) && "text-right",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr
                key={String(row.id ?? row[columns[0]!.key] ?? index)}
                className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 md:table-row md:h-11 md:p-0"
              >
                {columns.map((column, at) => (
                  <Cell
                    key={column.key}
                    column={column}
                    row={row}
                    first={at === 0}
                  />
                ))}
              </tr>
            ))}
          </tbody>
          {totals && shown.length > 0 && (
            <tfoot className="border-t border-border-strong bg-canvas font-semibold">
              <tr className="flex flex-col gap-1 px-4 py-3 md:table-row md:h-11 md:p-0">
                {columns.map((column, at) =>
                  at === 0 ? (
                    <th
                      key={column.key}
                      scope="row"
                      className="text-left md:px-4"
                    >
                      Total
                    </th>
                  ) : column.key in totals ? (
                    <Cell key={column.key} column={column} row={totals} />
                  ) : (
                    <td key={column.key} className="hidden md:table-cell" />
                  ),
                )}
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-ink-muted">
            No orders {ranged ? "in this date range" : "yet"}.
          </p>
        )}
      </div>

      <Pager
        page={page}
        pages={pages}
        total={rows.length}
        noun="lines"
        href={(page) => reportHref({ ...filters, page })}
      />
    </section>
  );
}

function ReportTabs({ filters }: { filters: ReportFilters }) {
  return (
    <nav
      aria-label="Reports"
      className="-mx-4 flex gap-6 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0"
    >
      {REPORT_KINDS.map((report) => {
        const active = report === filters.report;
        return (
          <Link
            key={report}
            href={reportHref({ ...filters, report, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors duration-150",
              active
                ? "border-navy text-navy"
                : "border-transparent text-ink-muted hover:text-navy",
            )}
          >
            {REPORTS[report].title}
          </Link>
        );
      })}
    </nav>
  );
}

const NUMERIC = new Set<Column["kind"]>([
  "money",
  "pieces",
  "count",
  "percent",
  "days",
]);

const numeric = (column: Column) => NUMERIC.has(column.kind);

// One cell. On phones a row stacks into a card: the first column is its
// heading, the rest are label / value lines.
function Cell({
  column,
  row,
  first = false,
}: {
  column: Column;
  row: ReportRow;
  first?: boolean;
}) {
  const value = row[column.key] ?? null;
  return (
    <td
      className={cn(
        "flex items-baseline justify-between gap-3 md:table-cell md:px-4",
        numeric(column) && "whitespace-nowrap num md:text-right",
        first && "whitespace-nowrap",
        column.kind === "percent" && Number(value) < 0 && "text-danger",
        column.kind === "money" &&
          String(value).startsWith("-") &&
          "text-danger",
      )}
    >
      {!first && (
        <span className="text-xs font-normal text-ink-muted md:hidden">
          {column.label}
        </span>
      )}
      <span className={cn("text-right md:text-left", first && "font-medium")}>
        {display(column, row, value)}
      </span>
    </td>
  );
}

function display(
  column: Column,
  row: ReportRow,
  value: string | number | null,
): React.ReactNode {
  if (value === null) return "";
  switch (column.kind) {
    case "money":
      return formatMoney(value);
    case "pieces":
      return formatPieces(Number(value));
    case "percent":
      return `${value}%`;
    case "days":
      return Number(value) === 1 ? "1 day" : `${value} days`;
    case "date":
      return formatDate(String(value));
    case "month":
      return formatMonth(String(value));
    case "status":
      return <StatusPill status={value as OrderStatus} />;
    default:
      return column.key === "orderNo" && row.id ? (
        <Link
          href={`/orders/${row.id}`}
          className="whitespace-nowrap text-navy num hover:underline"
        >
          {value}
        </Link>
      ) : (
        value
      );
  }
}

function rangeText({ from, to }: ReportFilters): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `from ${formatDate(from)}`;
  if (to) return `up to ${formatDate(to)}`;
  return "any day";
}
