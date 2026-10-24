import Link from "next/link";
import { DeactivatedBadge } from "@/components/deactivated-badge";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ProductView } from "@/services/products";

type Column = "customer" | "supplier" | "sellPrice" | "buyPrice" | "margin";

// Products as a table, stacked cards on phones. The Product list and the
// Customer and Supplier Products tabs pick their columns (SPEC §4.1–4.3).
// Margin comes only from rows the server filled in for the viewer's role; no
// brass here, as it would repeat on every row (DESIGN.md: once or twice).
export function ProductsTable({
  rows,
  columns,
  empty,
}: {
  rows: ProductView[];
  columns: Column[];
  empty: string;
}) {
  const show = (column: Column) => columns.includes(column);
  const money = "num whitespace-nowrap md:px-4 md:text-right";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="hidden bg-canvas md:table-header-group">
          <tr className="border-b border-border-strong text-left">
            <th className="px-4 py-3 section-label">Code</th>
            <th className="px-4 py-3 section-label">Product</th>
            {show("customer") && (
              <th className="px-4 py-3 section-label">Customer</th>
            )}
            {show("supplier") && (
              <th className="px-4 py-3 section-label">Supplier</th>
            )}
            {show("sellPrice") && (
              <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                Sell / pc
              </th>
            )}
            {show("buyPrice") && (
              <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                Buy / pc
              </th>
            )}
            {show("margin") && (
              <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                Margin / pc
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0 md:table-row md:h-11 md:p-0"
            >
              <td className="text-xs whitespace-nowrap text-ink-muted num md:px-4 md:text-sm">
                {row.code}
              </td>
              <td className="md:px-4">
                <Link
                  href={`/products/${row.id}`}
                  className="font-medium text-navy hover:underline"
                >
                  {row.name}
                </Link>
                {!row.isActive && <DeactivatedBadge className="ml-2" />}
              </td>
              {show("customer") && (
                <td className="text-ink-muted md:px-4 md:text-ink">
                  {row.customer.name}
                </td>
              )}
              {show("supplier") && (
                <td className="text-ink-muted md:px-4 md:text-ink">
                  {row.supplier.name}
                </td>
              )}
              {show("sellPrice") && (
                <td className={money}>
                  <span className="text-ink-muted md:hidden">Sell </span>
                  {formatMoney(row.sellPrice)}
                </td>
              )}
              {show("buyPrice") && (
                <td className={money}>
                  <span className="text-ink-muted md:hidden">Buy </span>
                  {formatMoney(row.buyPrice)}
                </td>
              )}
              {show("margin") && row.margin && (
                <td
                  className={cn(money, row.margin.percent < 0 && "text-danger")}
                >
                  <span className="text-ink-muted md:hidden">Margin </span>
                  {formatMoney(row.margin.perPiece)}{" "}
                  <span className="text-xs">({row.margin.percent}%)</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-6 text-center text-ink-muted">{empty}</p>
      )}
    </div>
  );
}
