"use client";

// PROTOTYPE ONLY: order context, dialogs and helpers shared by the documents panel variants.

import { useEffect, useState, useSyncExternalStore } from "react";
import { CircleCheck, Lock, MessageCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ORDER,
  STATUS_LABEL,
  TODAY,
  docNumber,
  docTitle,
  fileName,
  fmtDate,
  getDoc,
  pcs,
  sendWarnings,
  tk,
  woProgress,
  type DocRef,
  type OrderState,
  type OrderStatus,
} from "./model";

export type Role = "admin" | "manager" | "staff";

export type PanelApi = {
  state: OrderState;
  role: Role;
  isPhone: boolean;
  send: (ref: DocRef) => void;
  preview: (ref: DocRef) => void;
  tellSupplier: (letter: string) => void;
  complete: () => void;
};

export type PanelProps = { api: PanelApi };

export function useIsPhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

export function recipientOf(state: OrderState, ref: DocRef) {
  if (ref.kind === "wo")
    return state.wos.find((w) => w.letter === ref.letter)!.supplier;
  return ORDER.customer;
}

/* ---------- Status pill (DESIGN.md §1) ---------- */

const PILL: Record<OrderStatus, string> = {
  created: "bg-[var(--status-created-bg)] text-[var(--status-created-fg)]",
  wo_sent: "bg-[var(--status-wo-sent-bg)] text-[var(--status-wo-sent-fg)]",
  delivered:
    "bg-[var(--status-delivered-bg)] text-[var(--status-delivered-fg)]",
  invoiced: "bg-[var(--status-invoiced-bg)] text-[var(--status-invoiced-fg)]",
  completed:
    "bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]",
  cancelled:
    "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-fg)]",
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        PILL[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NeedsResendBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-warning px-1.5 text-[11px] font-medium text-warning">
      Needs re-send
    </span>
  );
}

/* ---------- Order header (context around the panel) ---------- */

export function OrderHeader({
  state,
  role,
  onUnlock,
}: {
  state: OrderState;
  role: Role;
  onUnlock: () => void;
}) {
  const p = woProgress(state);
  const sell = ORDER.items.reduce((n, i) => n + i.qty * i.sell, 0);
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={state.status} />
        {state.status === "created" && p.sent < p.total && (
          <span className="inline-flex h-6 items-center rounded-full bg-[var(--status-created-bg)] px-2.5 text-xs font-medium text-[var(--status-created-fg)]">
            WO {p.sent}/{p.total}
          </span>
        )}
        {state.locked && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border-strong px-2.5 text-xs text-ink-muted">
            <Lock className="size-3" /> Locked
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
        <div>
          <dt className="section-label">Customer</dt>
          <dd className="mt-0.5 font-medium text-ink">{ORDER.customer}</dd>
        </div>
        <div>
          <dt className="section-label">Order date</dt>
          <dd className="mt-0.5 text-ink">{fmtDate(ORDER.orderDate)}</dd>
        </div>
        <div>
          <dt className="section-label">Delivery</dt>
          <dd className="mt-0.5 text-ink">{fmtDate(ORDER.deliveryDate)}</dd>
        </div>
        <div>
          <dt className="section-label">Sell total</dt>
          <dd className="mt-0.5 font-medium text-ink num">{tk(sell)}</dd>
        </div>
      </dl>
      {state.locked && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-canvas px-3 py-2.5 text-sm text-ink-muted">
          <Lock className="size-4 shrink-0" />
          <span className="flex-1">
            Invoice sent, so this order is locked. Documents can still be
            downloaded.
          </span>
          {role === "admin" && (
            <Button variant="secondary" size="sm" onClick={onUnlock}>
              Unlock
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- Share / Download dialog ---------- */

export function SendDialog({
  target,
  state,
  isPhone,
  onClose,
  onConfirm,
}: {
  target: DocRef | null;
  state: OrderState;
  isPhone: boolean;
  onClose: () => void;
  onConfirm: (ref: DocRef, date: string, via: "share" | "download") => void;
}) {
  const doc = target ? getDoc(state, target) : null;
  const [date, setDate] = useState(TODAY);
  const [forKey, setForKey] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const key = target ? docNumber(target) : null;
  if (key !== forKey) {
    setForKey(key);
    setDate(doc?.date ?? TODAY);
    setSharing(false);
  }
  if (!target || !doc) return <Dialog open={false} />;

  const resend = !!doc.sentAt;
  const warnings = sendWarnings(state, target, date);
  const supplier =
    target.kind === "wo"
      ? state.wos.find((w) => w.letter === target.letter)!
      : null;
  const waNumber = supplier ? supplier.supplierPhone : "8801711245880";
  const waText = encodeURIComponent(
    `Assalamu alaikum. Please find ${docTitle(target)} ${docNumber(target)} from Zahir Enterprise.`,
  );

  const share = () => {
    // Prototype: stands in for GET pdf → navigator.share → POST { via: "share" } on success.
    setSharing(true);
    setTimeout(() => onConfirm(target, date, "share"), 700);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg text-navy">
            {isPhone ? "Share" : "Download"} {docNumber(target)}
          </DialogTitle>
          <DialogDescription>
            {docTitle(target)} to {recipientOf(state, target)}
            {resend &&
              doc.needsResend &&
              " · order changed since it was last sent"}
            {resend && !doc.needsResend && ` · already sent ${doc.sentAt}`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doc-date" className="text-ink-muted">
            {docTitle(target)} date
          </Label>
          <Input
            id="doc-date"
            type="date"
            value={date}
            disabled={state.locked}
            onChange={(e) => setDate(e.target.value)}
          />
          {state.locked && (
            <p className="text-xs text-ink-subtle">
              Dates are locked with the order.
            </p>
          )}
        </div>
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg bg-[var(--status-invoiced-bg)] px-3 py-2.5 text-sm text-warning">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter className="-mx-4 -mb-4 gap-2">
          {isPhone ? (
            <Button className="w-full" disabled={sharing} onClick={share}>
              {sharing ? "Opening share sheet…" : "Share PDF"}
            </Button>
          ) : (
            <>
              <Button variant="secondary" asChild>
                <a
                  href={`https://wa.me/${waNumber}?text=${waText}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle /> Open WhatsApp chat
                </a>
              </Button>
              <Button onClick={() => onConfirm(target, date, "download")}>
                Download PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Preview (A4 sketch of the real PDF, SPEC §8) ---------- */

export function PreviewDialog({
  target,
  state,
  onClose,
}: {
  target: DocRef | null;
  state: OrderState;
  onClose: () => void;
}) {
  if (!target) return <Dialog open={false} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-canvas sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-navy">
            {fileName(target, state)}
          </DialogTitle>
          <DialogDescription>
            Preview only. Not marked as sent.
          </DialogDescription>
        </DialogHeader>
        <PaperSheet target={target} state={state} />
      </DialogContent>
    </Dialog>
  );
}

export function PaperSheet({
  target,
  state,
  className,
}: {
  target: DocRef;
  state: OrderState;
  className?: string;
}) {
  const doc = getDoc(state, target);
  const supplier =
    target.kind === "wo"
      ? state.wos.find((w) => w.letter === target.letter)!
      : null;
  const rows =
    target.kind === "wo"
      ? supplier!.items.map((i) => ({ name: i.name, qty: i.qty, price: i.buy }))
      : ORDER.items.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: target.kind === "invoice" ? i.sell : null,
        }));
  const title =
    target.kind === "wo"
      ? "WORK ORDER"
      : target.kind === "challan"
        ? "DELIVERY CHALLAN"
        : "INVOICE";
  const total = rows.reduce((n, r) => n + r.qty * (r.price ?? 0), 0);

  return (
    <div
      className={cn(
        "aspect-[1/1.414] w-full bg-white p-[6%] text-[10px] leading-snug text-ink shadow-[0_1px_3px_rgba(8,31,63,0.12)]",
        className,
      )}
    >
      <div className="flex items-start justify-between border-b border-navy pb-[3%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/ze-logo-navy.svg"
          alt="Zahir Enterprise"
          className="w-[32%]"
        />
        <p className="text-right text-[0.8em] text-ink-muted">
          Zahir Enterprise
          <br />
          45 Nawabpur Road, Dhaka
          <br />
          01700-000 000
        </p>
      </div>
      <div className="mt-[4%] flex items-start justify-between">
        <div>
          <p className="text-[1.5em] font-semibold tracking-[0.15em] text-navy">
            {title}
          </p>
          <p className="mt-[2%] text-[0.85em] text-ink-muted">
            {target.kind === "wo" ? "To" : "To"}
          </p>
          <p className="font-medium">
            {target.kind === "wo" ? supplier!.supplier : ORDER.customer}
          </p>
        </div>
        <dl className="text-right text-[0.85em]">
          <dt className="text-ink-muted">No.</dt>
          <dd className="font-medium">{docNumber(target)}</dd>
          <dt className="mt-1 text-ink-muted">Date</dt>
          <dd className="font-medium">{fmtDate(doc.date ?? TODAY)}</dd>
        </dl>
      </div>
      <table className="mt-[4%] w-full border-collapse">
        <thead>
          <tr className="bg-table-head text-left text-[0.75em] tracking-wider uppercase">
            <th className="p-[1%]">#</th>
            <th className="p-[1%]">Product</th>
            <th className="p-[1%] text-right">Qty</th>
            {rows[0]?.price !== null && (
              <th className="p-[1%] text-right">Price</th>
            )}
            {rows[0]?.price !== null && (
              <th className="p-[1%] text-right">Total</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-b border-border">
              <td className="p-[1%]">{i + 1}</td>
              <td className="p-[1%]">{r.name}</td>
              <td className="p-[1%] text-right num">{pcs(r.qty)}</td>
              {r.price !== null && (
                <td className="p-[1%] text-right num">{r.price.toFixed(2)}</td>
              )}
              {r.price !== null && (
                <td className="p-[1%] text-right num">{tk(r.qty * r.price)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-[3%] border-t border-navy pt-[2%] text-right font-semibold num">
        {rows[0]?.price === null
          ? `Total: ${pcs(rows.reduce((n, r) => n + r.qty, 0))}`
          : tk(total)}
      </p>
    </div>
  );
}

/* ---------- Unlock ---------- */

export function UnlockDialog({
  open,
  onClose,
  onUnlock,
}: {
  open: boolean;
  onClose: () => void;
  onUnlock: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-navy">Unlock {ORDER.no}</DialogTitle>
          <DialogDescription>
            Recorded in the Activity Log. Sending the Invoice again re-locks it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unlock-reason" className="text-ink-muted">
            Reason
          </Label>
          <textarea
            id="unlock-reason"
            className="min-h-20 rounded-lg border border-input bg-surface px-3 py-2 text-base lg:text-sm"
            placeholder="e.g. Customer asked for 500 more bread packets"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter className="-mx-4 -mb-4">
          <Button
            disabled={!reason.trim()}
            onClick={() => onUnlock(reason.trim())}
          >
            Unlock order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Toast ---------- */

export function Toast({
  message,
  onDone,
}: {
  message: string | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 2600);
    return () => clearTimeout(id);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed top-[calc(env(safe-area-inset-top)+64px)] left-1/2 z-50 flex -translate-x-1/2 animate-in items-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-overlay duration-200 ease-out fade-in-0 slide-in-from-top-2 md:top-auto md:right-6 md:bottom-6 md:left-auto md:translate-x-0 md:slide-in-from-bottom-2"
    >
      <CircleCheck className="size-4 text-[#86efac]" />
      {message}
    </div>
  );
}
