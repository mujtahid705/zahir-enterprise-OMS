import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { DocumentPreview } from "@/components/orders/document-preview";
import { StatusPill } from "@/components/orders/status-pill";
import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { fileName } from "@/lib/documents";
import { formatMoney, formatPieces } from "@/lib/money";
import { cn } from "@/lib/utils";
import { orders, type OrderView } from "@/services/orders";

// The Order page (SPEC §9 /orders/[id]): header, items and documents.
// Buy totals and Margin arrive only for roles that may see them; the
// service leaves them out for Staff.

type IdParams = Promise<{ id: string }>;

// SPEC §6.2.
const WO_STATUS_LABEL: Record<
  OrderView["workOrders"][number]["status"],
  string
> = { pending: "Not sent", sent: "Sent", cancelled: "Cancelled" };

export function OrderDetailPage({ params }: { params: IdParams }) {
  return (
    <>
      <TopBar title="Orders" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <OrderDetail params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function OrderDetail({ params }: { params: IdParams }) {
  const actor = await getCurrentUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await orders.get(actor, id);
  if (!order) notFound();
  const { totals } = order;
  const supplierOf = new Map(
    order.workOrders.map((wo) => [wo.supplierId, wo.supplierName]),
  );
  const documentsUrl = `/api/orders/${order.id}/documents`;
  const details: [string, string | null][] = [
    ["Customer reference", order.customerRef],
    ["Delivery address", order.deliveryAddress],
    ["Invoice note", order.invoiceNote],
    ["Notes", order.notes],
  ];

  return (
    <section className="flex max-w-4xl flex-col gap-8">
      <div>
        <Link
          href="/orders"
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-navy"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
          Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-navy num">
            {order.orderNo}
          </h2>
          <StatusPill status={order.status} />
        </div>
        <p className="mt-1 text-ink">
          <Link
            href={`/customers/${order.customerId}`}
            className="font-medium text-navy hover:underline"
          >
            {order.customerName}
          </Link>
          <span className="text-ink-muted"> · {order.customerPhone}</span>
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Ordered {formatDate(order.orderDate)}
          {order.deliveryDate &&
            ` · Delivery by ${formatDate(order.deliveryDate)}`}
        </p>
      </div>

      <dl
        aria-label="Totals"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4"
      >
        <Figure term="Sell total">{formatMoney(totals.sell)}</Figure>
        {totals.buy !== null && (
          <>
            <Figure term="Buy total">{formatMoney(totals.buy)}</Figure>
            <Figure term="Margin" accent>
              {formatMoney(totals.margin!)}
            </Figure>
            <Figure term="Margin %" accent>
              {totals.marginPercent}%
            </Figure>
          </>
        )}
      </dl>

      <section className="flex flex-col gap-3">
        <h3 className="section-label">Items</h3>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="hidden bg-canvas md:table-header-group">
              <tr className="border-b border-border-strong text-left">
                <th className="px-4 py-3 section-label">Product</th>
                <th className="px-4 py-3 section-label">Supplier</th>
                <th className="px-4 py-3 text-right section-label">Qty</th>
                <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                  Sell / pc
                </th>
                <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                  Sell total
                </th>
                {totals.buy !== null && (
                  <th className="px-4 py-3 text-right section-label whitespace-nowrap">
                    Buy total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr
                  key={item.id}
                  className="flex flex-col gap-0.5 border-b border-border px-4 py-3 last:border-b-0 md:table-row md:p-0"
                >
                  <td className="md:px-4 md:py-3">
                    <p className="font-medium text-ink">{item.productName}</p>
                    {item.specText && (
                      <p className="text-xs text-ink-muted">{item.specText}</p>
                    )}
                  </td>
                  <td className="text-ink-muted md:px-4 md:text-ink">
                    {supplierOf.get(item.supplierId)}
                  </td>
                  <Amount>{formatPieces(item.quantity)}</Amount>
                  <Amount label="Sell / pc">
                    {formatMoney(item.sellPrice)}
                  </Amount>
                  <Amount label="Sell total">
                    {formatMoney(item.sellTotal)}
                  </Amount>
                  {item.buyTotal !== null && (
                    <Amount label="Buy total">
                      {formatMoney(item.buyTotal)}
                    </Amount>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="documents"
        className="flex flex-col rounded-xl border border-border bg-surface"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
          <h3 id="documents" className="section-label">
            Documents
          </h3>
          <p className="text-xs text-ink-muted">Preview never changes status</p>
        </div>
        <DocumentGroup title="To suppliers" label="Work Orders">
          {order.workOrders.map((wo) => (
            <DocumentRow
              key={wo.id}
              badge={wo.letter}
              number={wo.woNo}
              recipient={wo.supplierName}
              detail={`${wo.itemCount} ${wo.itemCount === 1 ? "item" : "items"} · ${formatPieces(wo.quantity)} · ${WO_STATUS_LABEL[wo.status]}`}
              url={`${documentsUrl}/wo/${wo.id}`}
            />
          ))}
        </DocumentGroup>
        <DocumentGroup title="To customer" label="Customer documents">
          <DocumentRow
            badge="CH"
            number={order.challanNo}
            recipient="Challan"
            url={`${documentsUrl}/challan`}
            fileNameRecipient={order.customerName}
          />
          <DocumentRow
            badge="INV"
            number={order.invoiceNo}
            recipient="Invoice"
            url={`${documentsUrl}/invoice`}
            fileNameRecipient={order.customerName}
          />
        </DocumentGroup>
      </section>

      <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 md:p-6">
        {details.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="section-label">{term}</dt>
            <dd
              className={cn("whitespace-pre-line", !value && "text-ink-subtle")}
            >
              {value || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DocumentGroup({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 pt-3 last:pb-1">
      <h4 className="text-xs text-ink-muted">{title}</h4>
      <ul aria-label={label} className="flex flex-col divide-y divide-border">
        {children}
      </ul>
    </div>
  );
}

// One document: its number, who it goes to and Preview. The PDF's file name
// is named after the recipient (a Customer document after the Customer).
function DocumentRow({
  badge,
  number,
  recipient,
  detail,
  url,
  fileNameRecipient = recipient,
}: {
  badge: string;
  number: string;
  recipient: string;
  detail?: string;
  url: string;
  fileNameRecipient?: string;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-canvas px-1 text-xs font-semibold text-navy">
        {badge}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          <span className="num">{number}</span> · {recipient}
        </p>
        {detail && <p className="text-xs text-ink-muted num">{detail}</p>}
      </div>
      <DocumentPreview
        url={url}
        fileName={fileName(number, fileNameRecipient)}
      />
    </li>
  );
}

function Amount({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <td className="whitespace-nowrap num md:px-4 md:text-right">
      {label && <span className="text-ink-muted md:hidden">{label} </span>}
      {children}
    </td>
  );
}

function Figure({
  term,
  accent = false,
  children,
}: {
  term: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface p-4">
      <dt className="text-xs text-ink-muted">{term}</dt>
      <dd
        className={cn(
          "text-lg font-semibold num",
          accent ? "text-brass" : "text-navy",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
