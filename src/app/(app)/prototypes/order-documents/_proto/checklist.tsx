"use client";

// PROTOTYPE variant "Checklist": every document as a compact row, actions inline.

import {
  Check,
  Circle,
  Download,
  Eye,
  RefreshCw,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { docNumber, fmtDate, type DocRef, type DocState } from "./model";
import { NeedsResendBadge, recipientOf, type PanelProps } from "./shared";

export function Checklist({ api }: PanelProps) {
  const { state } = api;
  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <h2 className="section-label">Documents</h2>
        <span className="text-xs text-ink-muted">
          Preview never changes status
        </span>
      </header>

      <h3 className="px-4 pt-4 pb-1 text-xs font-medium text-ink-muted md:px-6">
        To suppliers
      </h3>
      <ul className="divide-y divide-border">
        {state.wos.map((w) => {
          const ref: DocRef = { kind: "wo", letter: w.letter };
          if (w.status === "cancelled")
            return (
              <li
                key={w.letter}
                className="flex items-start gap-3 px-4 py-3 md:px-6"
              >
                <StateIcon kind="cancelled" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-subtle line-through">
                    {docNumber(ref)} · {w.supplier}
                  </p>
                  {w.supplierTold ? (
                    <p className="text-xs text-ink-subtle">
                      Cancelled · supplier told
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-danger">
                      Tell {w.supplier} that {docNumber(ref)} is cancelled.
                    </p>
                  )}
                </div>
                {!w.supplierTold && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => api.tellSupplier(w.letter)}
                  >
                    Done
                  </Button>
                )}
              </li>
            );
          return <Row key={w.letter} api={api} docRef={ref} doc={w} />;
        })}
      </ul>

      <h3 className="border-t border-border px-4 pt-4 pb-1 text-xs font-medium text-ink-muted md:px-6">
        To customer
      </h3>
      <ul className="divide-y divide-border">
        <Row api={api} docRef={{ kind: "challan" }} doc={state.challan} />
        <Row api={api} docRef={{ kind: "invoice" }} doc={state.invoice} />
      </ul>
    </section>
  );
}

function Row({
  api,
  docRef,
  doc,
}: {
  api: PanelProps["api"];
  docRef: DocRef;
  doc: DocState;
}) {
  const kind = doc.needsResend ? "resend" : doc.sentAt ? "sent" : "pending";
  const label =
    docRef.kind === "wo"
      ? "Work Order"
      : docRef.kind === "challan"
        ? "Challan"
        : "Invoice";
  const SendIcon = api.isPhone ? Share2 : Download;
  return (
    <li className="flex items-center gap-3 px-4 py-3 md:px-6">
      <StateIcon kind={kind} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-ink">{docNumber(docRef)}</span>
          <span className="truncate text-ink-muted">
            {docRef.kind === "wo" ? recipientOf(api.state, docRef) : label}
          </span>
          {doc.needsResend && <NeedsResendBadge />}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {doc.sentAt
            ? `Sent ${doc.sentAt} · dated ${fmtDate(doc.date)}`
            : "Not sent"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Preview ${docNumber(docRef)}`}
        onClick={() => api.preview(docRef)}
      >
        <Eye className="text-ink-muted" strokeWidth={1.5} />
      </Button>
      <Button
        variant={kind === "sent" ? "secondary" : "default"}
        size="icon"
        aria-label={`${api.isPhone ? "Share" : "Download"} ${docNumber(docRef)}`}
        onClick={() => api.send(docRef)}
      >
        <SendIcon strokeWidth={1.75} />
      </Button>
    </li>
  );
}

function StateIcon({
  kind,
}: {
  kind: "pending" | "sent" | "resend" | "cancelled";
}) {
  const base = "flex size-6 shrink-0 items-center justify-center rounded-full";
  if (kind === "sent")
    return (
      <span className={cn(base, "bg-success text-white")} aria-label="Sent">
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  if (kind === "resend")
    return (
      <span
        className={cn(base, "border border-warning text-warning")}
        aria-label="Needs re-send"
      >
        <RefreshCw className="size-3.5" />
      </span>
    );
  if (kind === "cancelled")
    return (
      <span
        className={cn(base, "bg-canvas text-ink-subtle")}
        aria-label="Cancelled"
      >
        <X className="size-3.5" />
      </span>
    );
  return (
    <Circle
      className="size-6 shrink-0 text-border-strong"
      strokeWidth={1.25}
      aria-label="Not sent"
    />
  );
}
