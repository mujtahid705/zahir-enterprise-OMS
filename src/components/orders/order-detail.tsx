import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  Circle,
  Lock,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { z } from "zod";
import {
  DetailTabs,
  RecordHistory,
  historyTab,
} from "@/components/activity/record-history";
import { DeactivatedBadge } from "@/components/deactivated-badge";
import { AcknowledgeCancel } from "@/components/orders/acknowledge-cancel";
import { DocumentPreview } from "@/components/orders/document-preview";
import { RefreshPrices } from "@/components/orders/refresh-prices";
import {
  CancelOrder,
  ChangeStatus,
  MarkCompleted,
  RestoreOrder,
  UnlockOrder,
} from "@/components/orders/status-controls";
import {
  SendDocument,
  SendToast,
  type SendDocumentProps,
} from "@/components/orders/send-document";
import {
  NeedsResendBadge,
  StatusPill,
  WoProgressBadge,
} from "@/components/orders/status-pill";
import { TopBar } from "@/components/shell/top-bar";
import { DetailSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { eventLine } from "@/lib/activity-log";
import { getCurrentUser } from "@/lib/auth";
import type { SearchParams } from "@/lib/fields";
import { formatDate, formatDateTime, todayInDhaka } from "@/lib/dates";
import { fileName, type DocumentRef } from "@/lib/documents";
import { formatMoney, formatPieces } from "@/lib/money";
import { editBlock, statusTargets, woProgress } from "@/lib/orders";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  orders,
  type OrderHistoryEntry,
  type OrderView,
} from "@/services/orders";

// The Order page (SPEC §9 /orders/[id]): header, items, documents and
// history. Buy totals and Margin arrive only for roles that may see them;
// the service leaves them out for Staff.

type IdParams = Promise<{ id: string }>;

const DOCUMENT_LABEL: Record<DocumentRef["type"], string> = {
  work_order: "Work Order",
  challan: "Challan",
  invoice: "Invoice",
};

export function OrderDetailPage({
  params,
  searchParams,
}: {
  params: IdParams;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <>
      <TopBar title="Orders" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense fallback={<DetailSkeleton />}>
          <OrderDetail params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function OrderDetail({
  params,
  searchParams,
}: {
  params: IdParams;
  searchParams: Promise<SearchParams>;
}) {
  const actor = await getCurrentUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Admins also get the full Activity Log of the Order (SPEC §9).
  const href = `/orders/${id}`;
  const tab = historyTab(actor, await searchParams, href);
  const [order, history] = await Promise.all([
    orders.get(actor, id),
    orders.history(actor, id),
  ]);
  if (!order) notFound();
  const { totals } = order;
  const openWos = order.workOrders.filter((wo) => wo.status !== "cancelled");
  const progress = woProgress({
    sent: openWos.filter((wo) => wo.status === "sent").length,
    total: openWos.length,
  });
  const supplierOf = new Map(
    order.workOrders.map((wo) => [wo.supplierId, wo.supplierName]),
  );
  // Editable until locked; after sending, saving says what goes stale
  // (SPEC §5.5).
  const editable = !editBlock(order);
  const version = {
    orderId: order.id,
    updatedAt: order.updatedAt?.toISOString() ?? null,
  };
  const cancelled = order.status === "cancelled";
  const targets = statusTargets(actor.role, order.status);
  const completesOrCancels = can(actor.role, "completeOrCancel");
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
          {progress && <WoProgressBadge label={progress} />}
          {order.isLocked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-ink-muted">
              <Lock className="size-3" strokeWidth={1.75} /> Locked
            </span>
          )}
        </div>
        <p className="mt-1 text-ink">
          <Link
            href={`/customers/${order.customerId}`}
            className="font-medium text-navy hover:underline"
          >
            {order.customerName}
          </Link>
          <span className="text-ink-muted"> · {order.customerPhone}</span>
          {order.customerDeactivated && (
            <DeactivatedBadge className="ml-2 align-middle" />
          )}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Ordered {formatDate(order.orderDate)}
          {order.deliveryDate &&
            ` · Delivery by ${formatDate(order.deliveryDate)}`}
        </p>
        {order.isLocked && !cancelled && (
          <HeaderStrip
            icon={<Lock className="size-4 shrink-0" strokeWidth={1.75} />}
            action={
              can(actor.role, "unlockOrder") && <UnlockOrder {...version} />
            }
          >
            {order.invoiceDownloadedAt ? "Invoice sent, so this" : "This"} order
            is locked. Documents can still be downloaded.
          </HeaderStrip>
        )}
        {cancelled && (
          <HeaderStrip
            action={completesOrCancels && <RestoreOrder {...version} />}
          >
            Cancelled
            {order.cancelledAt && ` ${formatDateTime(order.cancelledAt)}`}
            {order.cancelReason && `: ${order.cancelReason}`}. This order is
            read only.
          </HeaderStrip>
        )}
        {editable && (
          <div className="mt-4 flex flex-wrap items-start gap-2">
            <Button asChild>
              <Link href={`/orders/${order.id}/edit`}>
                <Pencil strokeWidth={1.5} />
                Edit order
              </Link>
            </Button>
            {can(actor.role, "overridePrices") && (
              <RefreshPrices {...version} />
            )}
          </div>
        )}
        {completesOrCancels && !cancelled && (
          <div className="mt-4 flex flex-wrap items-start gap-2">
            {order.status !== "completed" && <MarkCompleted {...version} />}
            <CancelOrder {...version} />
          </div>
        )}
        {targets.length > 0 && (
          <div className="mt-4">
            <ChangeStatus {...version} targets={targets} />
          </div>
        )}
      </div>

      <DetailTabs label="Order" first="Order" path={href} tab={tab} />

      {tab.open ? (
        <RecordHistory
          actor={actor}
          scope={{ orderId: order.id }}
          page={tab.page}
          pageHref={tab.pageHref}
        />
      ) : (
        <>
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
                        <p className="font-medium text-ink">
                          {item.productName}
                          {item.deactivated && (
                            <DeactivatedBadge className="ml-2 align-middle" />
                          )}
                        </p>
                        {item.specText && (
                          <p className="text-xs text-ink-muted">
                            {item.specText}
                          </p>
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

          <DocumentsPanel order={order} />

          <dl className="grid gap-x-8 gap-y-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 md:p-6">
            {details.map(([term, value]) => (
              <div key={term} className="flex flex-col gap-1">
                <dt className="section-label">{term}</dt>
                <dd
                  className={cn(
                    "whitespace-pre-line",
                    !value && "text-ink-subtle",
                  )}
                >
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>

          <OrderHistory entries={history} />
        </>
      )}
    </section>
  );
}

// The documents panel, "Checklist" (DESIGN §7b): every Work Order, then
// the Challan and Invoice, each with its state, Preview and send button.
function DocumentsPanel({ order }: { order: OrderView }) {
  const url = `/api/orders/${order.id}/documents`;
  const today = todayInDhaka();
  // A cancelled Order's documents can't be sent (SPEC §5.5): Preview only.
  const readOnly = order.status === "cancelled";
  const shared = {
    locked: order.isLocked,
    pendingWorkOrders: order.workOrders.filter((wo) => wo.status === "pending")
      .length,
    challanSent: !!order.challanDownloadedAt,
    orderDate: order.orderDate,
    today,
  };
  const customerDoc = (
    ref: { type: "challan" } | { type: "invoice" },
    number: string,
    storedDate: string | null,
    sentAt: Date | null,
    needsResend: boolean,
  ): SendDocumentProps => ({
    ...shared,
    url: `${url}/${ref.type}`,
    docRef: ref,
    number,
    title: DOCUMENT_LABEL[ref.type],
    recipient: order.customerName,
    fileName: fileName(number, order.customerName),
    whatsapp: order.customerWhatsapp,
    storedDate,
    sentAt: sentAt && formatDateTime(sentAt),
    needsResend,
  });

  return (
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
      <SendToast />
      <DocumentGroup title="To suppliers" label="Work Orders">
        {order.workOrders.map((wo) =>
          wo.status === "cancelled" ? (
            <CancelledWorkOrder key={wo.id} orderId={order.id} wo={wo} />
          ) : (
            <DocumentRow
              key={wo.id}
              readOnly={readOnly}
              subtitle={wo.supplierName}
              send={{
                ...shared,
                url: `${url}/wo/${wo.id}`,
                docRef: { type: "work_order", workOrderId: wo.id },
                number: wo.woNo,
                title: DOCUMENT_LABEL.work_order,
                recipient: wo.supplierName,
                fileName: fileName(wo.woNo, wo.supplierName),
                whatsapp: wo.supplierWhatsapp,
                storedDate: wo.woDate,
                sentAt: wo.sentAt && formatDateTime(wo.sentAt),
                needsResend: wo.status === "sent" && wo.needsResend,
              }}
            />
          ),
        )}
      </DocumentGroup>
      <DocumentGroup title="To customer" label="Customer documents">
        <DocumentRow
          readOnly={readOnly}
          subtitle="Challan"
          send={customerDoc(
            { type: "challan" },
            order.challanNo,
            order.challanDate,
            order.challanDownloadedAt,
            !!order.challanDownloadedAt && order.challanNeedsResend,
          )}
        />
        <DocumentRow
          readOnly={readOnly}
          subtitle="Invoice"
          send={customerDoc(
            { type: "invoice" },
            order.invoiceNo,
            order.invoiceDate,
            order.invoiceDownloadedAt,
            false,
          )}
        />
      </DocumentGroup>
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
    <div className="border-b border-border px-4 pt-3 last:border-b-0">
      <h4 className="text-xs font-medium text-ink-muted">{title}</h4>
      <ul aria-label={label} className="flex flex-col divide-y divide-border">
        {children}
      </ul>
    </div>
  );
}

// One document: state, number, who it goes to and when it was sent, then
// Preview and the send button.
function DocumentRow({
  subtitle,
  send,
  readOnly,
}: {
  // The Supplier for a Work Order, else the document's name.
  subtitle: string;
  send: SendDocumentProps;
  readOnly: boolean;
}) {
  const state = send.needsResend ? "resend" : send.sentAt ? "sent" : "pending";
  return (
    <li
      aria-label={`${send.number} · ${subtitle}`}
      className="flex items-center gap-3 py-3"
    >
      <StateIcon state={state} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-ink num">{send.number}</span>
          <span className="truncate text-ink-muted">{subtitle}</span>
          {send.needsResend && <NeedsResendBadge />}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted num">
          {send.sentAt
            ? `Sent ${send.sentAt}${send.storedDate ? ` · dated ${formatDate(send.storedDate)}` : ""}`
            : "Not sent"}
        </p>
      </div>
      <DocumentPreview url={send.url} fileName={send.fileName} />
      {!readOnly && <SendDocument {...send} />}
    </li>
  );
}

// A sent Work Order whose Supplier has no items left (SPEC §6.2): Done
// records that the Supplier was told.
function CancelledWorkOrder({
  orderId,
  wo,
}: {
  orderId: string;
  wo: OrderView["workOrders"][number];
}) {
  return (
    <li
      aria-label={`${wo.woNo} · ${wo.supplierName}`}
      className="flex items-start gap-3 py-3"
    >
      <StateIcon state="cancelled" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-subtle line-through">
          <span className="num">{wo.woNo}</span> · {wo.supplierName}
        </p>
        {wo.cancelAcknowledgedAt ? (
          <p className="text-xs text-ink-subtle">Cancelled · supplier told</p>
        ) : (
          <p className="mt-1 text-sm text-danger">
            Tell {wo.supplierName} that {wo.woNo} is cancelled.
          </p>
        )}
      </div>
      {!wo.cancelAcknowledgedAt && (
        <AcknowledgeCancel
          orderId={orderId}
          workOrderId={wo.id}
          woNo={wo.woNo}
        />
      )}
    </li>
  );
}

// DESIGN §7b state icons, 24px.
function StateIcon({
  state,
}: {
  state: "pending" | "sent" | "resend" | "cancelled";
}) {
  const circle =
    "flex size-6 shrink-0 items-center justify-center rounded-full";
  if (state === "sent")
    return (
      <span
        role="img"
        aria-label="Sent"
        className={cn(circle, "bg-success text-white")}
      >
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  if (state === "resend")
    return (
      <span
        role="img"
        aria-label="Needs re-send"
        className={cn(circle, "border border-warning text-warning")}
      >
        <RefreshCw className="size-3.5" strokeWidth={1.75} />
      </span>
    );
  if (state === "cancelled")
    return (
      <span
        role="img"
        aria-label="Cancelled"
        className={cn(circle, "bg-canvas text-ink-subtle")}
      >
        <X className="size-3.5" strokeWidth={1.75} />
      </span>
    );
  return (
    <Circle
      role="img"
      aria-label="Not sent"
      className="size-6 shrink-0 text-border-strong"
      strokeWidth={1.25}
    />
  );
}

// This Order's status and document history, for every role (SPEC §6.4).
function OrderHistory({ entries }: { entries: OrderHistoryEntry[] }) {
  return (
    <section aria-labelledby="history" className="flex flex-col gap-3">
      <h3 id="history" className="section-label">
        History
      </h3>
      {entries.length ? (
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <p className="flex-1 text-sm text-ink">{eventLine(entry)}</p>
              <p className="text-xs text-ink-muted num">
                {entry.userName ?? "System"} ·{" "}
                {formatDateTime(entry.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-muted">
          Nothing sent yet. Sending a document is recorded here.
        </p>
      )}
    </section>
  );
}

// A canvas strip under the Order header (DESIGN §7b): locked or cancelled,
// with its Unlock or Restore.
function HeaderStrip({
  icon,
  action,
  children,
}: {
  icon?: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-canvas px-3 py-2.5 text-sm text-ink-muted">
      {icon}
      <p className="flex-1">{children}</p>
      {action}
    </div>
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
