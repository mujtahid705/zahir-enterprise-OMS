"use client";

// PROTOTYPE variant "Next step": the panel tells you the one thing to do now.

import {
  Check,
  ChevronDown,
  Download,
  PartyPopper,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  docNumber,
  docTitle,
  fmtDate,
  woProgress,
  type DocRef,
  type OrderState,
} from "./model";
import {
  NeedsResendBadge,
  recipientOf,
  type PanelProps,
  type Role,
} from "./shared";

type Next =
  | { type: "tell"; letter: string; supplier: string; no: string }
  | { type: "send"; ref: DocRef; why: string }
  | { type: "complete" }
  | { type: "wait" }
  | { type: "done" };

function nextAction(s: OrderState, role: Role): Next {
  const told = s.wos.find((w) => w.status === "cancelled" && !w.supplierTold);
  if (told)
    return {
      type: "tell",
      letter: told.letter,
      supplier: told.supplier,
      no: docNumber({ kind: "wo", letter: told.letter }),
    };
  const resendWo = s.wos.find((w) => w.status === "sent" && w.needsResend);
  if (resendWo)
    return {
      type: "send",
      ref: { kind: "wo", letter: resendWo.letter },
      why: "The order changed after this Work Order was sent.",
    };
  const pending = s.wos.find((w) => w.status === "pending");
  if (pending) {
    const p = woProgress(s);
    return {
      type: "send",
      ref: { kind: "wo", letter: pending.letter },
      why: `Work Order ${p.sent + 1} of ${p.total}. Send it so the supplier can start production.`,
    };
  }
  if (!s.challan.sentAt || s.challan.needsResend)
    return {
      type: "send",
      ref: { kind: "challan" },
      why: s.challan.needsResend
        ? "The order changed after the Challan was sent."
        : "Goods ready? Send the Challan with the delivery.",
    };
  if (!s.invoice.sentAt)
    return {
      type: "send",
      ref: { kind: "invoice" },
      why: "Delivered. Send the Invoice to get paid. This locks the order.",
    };
  if (s.status === "completed") return { type: "done" };
  return role === "staff" ? { type: "wait" } : { type: "complete" };
}

export function NextStep({ api }: PanelProps) {
  const { state, role, isPhone } = api;
  const next = nextAction(state, role);
  const SendIcon = isPhone ? Share2 : Download;

  return (
    <section className="flex flex-col gap-4">
      <Track state={state} />

      <div className="relative overflow-hidden rounded-xl bg-navy p-5 text-white md:p-6">
        <svg
          viewBox="0 0 120 120"
          aria-hidden
          className="absolute -right-6 -bottom-6 size-32 opacity-20"
        >
          {[0, 16, 32].map((d) => (
            <line
              key={d}
              x1={30 + d}
              y1={120}
              x2={117 + d}
              y2={0}
              stroke="var(--brass)"
              strokeWidth={1}
            />
          ))}
        </svg>
        <p className="section-label text-sidebar-text">Next step</p>
        {next.type === "send" && (
          <>
            <p className="mt-2 text-xl font-semibold">
              {getSendVerb(state, next.ref, isPhone)} {docTitle(next.ref)}{" "}
              {docNumber(next.ref)}
            </p>
            <p className="mt-1 text-sm text-sidebar-text">
              To {recipientOf(state, next.ref)}. {next.why}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="bg-white text-navy hover:bg-white/90"
                onClick={() => api.send(next.ref)}
              >
                <SendIcon /> {isPhone ? "Share" : "Download"}{" "}
                {docNumber(next.ref)}
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => api.preview(next.ref)}
              >
                Preview
              </Button>
            </div>
          </>
        )}
        {next.type === "tell" && (
          <>
            <p className="mt-2 text-xl font-semibold">
              Tell {next.supplier} that {next.no} is cancelled
            </p>
            <p className="mt-1 text-sm text-sidebar-text">
              Their items were removed from the order after the WO was sent.
            </p>
            <Button
              className="mt-5 bg-white text-navy hover:bg-white/90"
              onClick={() => api.tellSupplier(next.letter)}
            >
              <Check /> I’ve told them
            </Button>
          </>
        )}
        {next.type === "complete" && (
          <>
            <p className="mt-2 text-xl font-semibold">
              Mark as Completed once paid
            </p>
            <p className="mt-1 text-sm text-sidebar-text">
              Customer has paid ZE and ZE has paid the suppliers.
            </p>
            <Button
              className="mt-5 bg-white text-navy hover:bg-white/90"
              onClick={api.complete}
            >
              <Check /> Mark completed
            </Button>
          </>
        )}
        {next.type === "wait" && (
          <>
            <p className="mt-2 text-xl font-semibold">Waiting for payment</p>
            <p className="mt-1 text-sm text-sidebar-text">
              A manager marks the order Completed once everyone is paid.
            </p>
          </>
        )}
        {next.type === "done" && (
          <p className="mt-2 flex items-center gap-2 text-xl font-semibold">
            <PartyPopper className="size-5 text-brass" /> Order complete
          </p>
        )}
      </div>

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 md:px-6">
          <span className="section-label">All documents</span>
          <ChevronDown className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <ul className="divide-y divide-border border-t border-border">
          {[
            ...state.wos.map((w) => ({
              ref: { kind: "wo", letter: w.letter } as DocRef,
              doc: w,
              cancelled: w.status === "cancelled",
            })),
            {
              ref: { kind: "challan" } as DocRef,
              doc: state.challan,
              cancelled: false,
            },
            {
              ref: { kind: "invoice" } as DocRef,
              doc: state.invoice,
              cancelled: false,
            },
          ].map(({ ref, doc, cancelled }) => (
            <li
              key={docNumber(ref)}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm md:px-6"
            >
              <span
                className={cn(
                  "font-medium",
                  cancelled ? "text-ink-subtle line-through" : "text-ink",
                )}
              >
                {docNumber(ref)}
              </span>
              <span className="text-ink-muted">{recipientOf(state, ref)}</span>
              {doc.needsResend && <NeedsResendBadge />}
              <span className="ml-auto text-xs text-ink-muted">
                {cancelled
                  ? "Cancelled"
                  : doc.sentAt
                    ? `Sent · ${fmtDate(doc.date)}`
                    : "Not sent"}
              </span>
              {!cancelled && (
                <span className="flex w-full justify-end gap-3 md:w-auto">
                  <button
                    className="text-sm text-navy underline-offset-4 hover:underline"
                    onClick={() => api.preview(ref)}
                  >
                    Preview
                  </button>
                  <button
                    className="text-sm text-navy underline-offset-4 hover:underline"
                    onClick={() => api.send(ref)}
                  >
                    {doc.sentAt
                      ? isPhone
                        ? "Share again"
                        : "Download again"
                      : isPhone
                        ? "Share"
                        : "Download"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function getSendVerb(s: OrderState, ref: DocRef, isPhone: boolean) {
  const resend =
    ref.kind === "wo"
      ? s.wos.find((w) => w.letter === ref.letter)!.needsResend
      : s[ref.kind].needsResend;
  if (resend) return "Re-send";
  return isPhone ? "Share" : "Send";
}

function Track({ state }: { state: OrderState }) {
  const p = woProgress(state);
  const steps = [
    {
      label: "Work Orders",
      sub: `${p.sent}/${p.total} sent`,
      done: p.total > 0 && p.sent === p.total,
      warn: state.wos.some((w) => w.needsResend),
    },
    {
      label: "Challan",
      sub: state.challan.sentAt ? fmtDate(state.challan.date) : "Not sent",
      done: !!state.challan.sentAt,
      warn: state.challan.needsResend,
    },
    {
      label: "Invoice",
      sub: state.invoice.sentAt ? fmtDate(state.invoice.date) : "Not sent",
      done: !!state.invoice.sentAt,
      warn: false,
    },
    {
      label: "Completed",
      sub: state.status === "completed" ? "Paid" : "Manual",
      done: state.status === "completed",
      warn: false,
    },
  ];
  return (
    <ol className="grid grid-cols-4 gap-1">
      {steps.map((s) => (
        <li key={s.label} className="flex flex-col gap-1.5">
          <span
            className={cn(
              "h-1 rounded-full",
              s.warn ? "bg-warning" : s.done ? "bg-navy" : "bg-border",
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              s.done ? "text-navy" : "text-ink-muted",
            )}
          >
            {s.label}
          </span>
          <span
            className={cn(
              "text-[11px]",
              s.warn ? "text-warning" : "text-ink-subtle",
            )}
          >
            {s.warn ? "Needs re-send" : s.sub}
          </span>
        </li>
      ))}
    </ol>
  );
}
