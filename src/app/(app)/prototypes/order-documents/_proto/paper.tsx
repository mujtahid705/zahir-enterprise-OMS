"use client";

// PROTOTYPE variant "Paper": documents as page thumbnails, the way they'll look when sent.

import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { docNumber, fmtDate, type DocRef, type DocState } from "./model";
import { PaperSheet, recipientOf, type PanelProps } from "./shared";

export function Paper({ api }: PanelProps) {
  const { state } = api;
  const cards: {
    ref: DocRef;
    doc: DocState;
    cancelled?: boolean;
    told?: boolean;
  }[] = [
    ...state.wos.map((w) => ({
      ref: { kind: "wo", letter: w.letter } as DocRef,
      doc: w,
      cancelled: w.status === "cancelled",
      told: w.supplierTold,
    })),
    { ref: { kind: "challan" }, doc: state.challan },
    { ref: { kind: "invoice" }, doc: state.invoice },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="section-label">Documents</h2>
        <span className="text-xs text-ink-muted">Tap a page to preview</span>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 xl:grid-cols-5">
        {cards.map(({ ref, doc, cancelled, told }) => (
          <li
            key={docNumber(ref)}
            className="w-[46%] shrink-0 snap-start md:w-auto"
          >
            <Card
              api={api}
              docRef={ref}
              doc={doc}
              cancelled={cancelled}
              told={told}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({
  api,
  docRef,
  doc,
  cancelled,
  told,
}: {
  api: PanelProps["api"];
  docRef: DocRef;
  doc: DocState;
  cancelled?: boolean;
  told?: boolean;
}) {
  const SendIcon = api.isPhone ? Share2 : Download;
  const tag = cancelled
    ? { text: "Cancelled", cls: "bg-[var(--status-cancelled-bg)] text-danger" }
    : doc.needsResend
      ? {
          text: "Needs re-send",
          cls: "border border-warning bg-white text-warning",
        }
      : doc.sentAt
        ? {
            text: `Sent ${fmtDate(doc.date)}`,
            cls: "bg-[var(--status-completed-bg)] text-success",
          }
        : {
            text: "Not sent",
            cls: "bg-[var(--status-created-bg)] text-[var(--status-created-fg)]",
          };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => api.preview(docRef)}
        aria-label={`Preview ${docNumber(docRef)}`}
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-canvas p-2 transition-[border-color] duration-150 hover:border-border-strong",
          cancelled && "opacity-60",
        )}
      >
        <PaperSheet
          target={docRef}
          state={api.state}
          className="pointer-events-none text-[4px]"
        />
        <span
          className={cn(
            "absolute top-3 left-3 rounded-full px-2 py-0.5 text-[11px] font-medium",
            tag.cls,
          )}
        >
          {tag.text}
        </span>
        {cancelled && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="-rotate-[36deg] border-2 border-danger/60 px-3 py-1 text-sm font-semibold tracking-[0.2em] text-danger/70">
              CANCELLED
            </span>
          </span>
        )}
      </button>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-medium",
            cancelled ? "text-ink-subtle line-through" : "text-ink",
          )}
        >
          {docNumber(docRef)}
        </p>
        <p className="truncate text-xs text-ink-muted">
          {recipientOf(api.state, docRef)}
        </p>
      </div>
      {cancelled ? (
        told ? (
          <p className="text-xs text-ink-subtle">Supplier told</p>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              api.tellSupplier(docRef.kind === "wo" ? docRef.letter : "")
            }
          >
            Supplier told
          </Button>
        )
      ) : (
        <Button
          size="sm"
          variant={doc.sentAt && !doc.needsResend ? "secondary" : "default"}
          onClick={() => api.send(docRef)}
        >
          <SendIcon />{" "}
          {doc.sentAt && !doc.needsResend
            ? "Again"
            : api.isPhone
              ? "Share"
              : "Download"}
        </Button>
      )}
    </div>
  );
}
