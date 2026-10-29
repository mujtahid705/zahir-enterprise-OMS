"use client";

import {
  CircleCheck,
  Download,
  MessageCircle,
  Share2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentRef } from "@/lib/documents";
import { sendWarnings, whatsappLink, type SendVia } from "@/lib/sending";

// The send button of one document and its Share / Download dialog (SPEC
// §6.3, §8.0, §8.4, DESIGN §7b). Phones that can share files get Share: the
// PDF is fetched (GET) as the dialog opens, handed to the share sheet, and
// only a completed share is recorded (POST). Everywhere else Download records
// it and saves the PDF the POST answers with.

export type SendDocumentProps = {
  // The document's endpoint (SPEC §13.2).
  url: string;
  docRef: DocumentRef;
  number: string;
  // "Work Order", "Challan", "Invoice".
  title: string;
  recipient: string;
  fileName: string;
  whatsapp: string;
  storedDate: string | null;
  // Formatted, e.g. "21 Oct 2026, 11:20 AM".
  sentAt: string | null;
  needsResend: boolean;
  locked: boolean;
  pendingWorkOrders: number;
  challanSent: boolean;
  orderDate: string;
  today: string;
};

const PDF_PROBE = () => [
  new File([""], "probe.pdf", { type: "application/pdf" }),
];

// Phones only: desktop browsers that can share files still get Download
// (DESIGN §7b).
function canShareFiles(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: PDF_PROBE() })
  );
}

function useCanShareFiles(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(pointer: coarse)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    canShareFiles,
    () => false,
  );
}

export function SendDocument(props: SendDocumentProps) {
  const { number, sentAt, needsResend } = props;
  const share = useCanShareFiles();
  const [open, setOpen] = useState(false);
  const Icon = share ? Share2 : Download;
  const verb = share ? "Share" : "Download";
  const due = !sentAt || needsResend;

  return (
    <>
      <Button
        variant={due ? "default" : "secondary"}
        size="icon"
        aria-label={`${verb} ${number}`}
        onClick={() => setOpen(true)}
      >
        <Icon strokeWidth={1.75} />
      </Button>
      {open && (
        <SendDialog
          {...props}
          share={share}
          onClose={() => setOpen(false)}
          onSent={(message) => {
            setOpen(false);
            setToast({ message });
          }}
        />
      )}
    </>
  );
}

function SendDialog({
  url,
  docRef,
  number,
  title,
  recipient,
  fileName,
  whatsapp,
  storedDate,
  sentAt,
  needsResend,
  locked,
  pendingWorkOrders,
  challanSent,
  orderDate,
  today,
  share,
  onClose,
  onSent,
}: SendDocumentProps & {
  share: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(storedDate ?? today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The PDF for the share sheet, fetched ahead: Safari only opens the sheet
  // straight from a tap, not after waiting on the network.
  const [file, setFile] = useState<{ date: string; file: File } | null>(null);
  const verb = share ? "Share" : "Download";
  const warnings = sendWarnings({
    ref: docRef,
    pendingWorkOrders,
    challanSent,
    locked,
    orderDate,
    today,
    date,
  });
  const chat = whatsappLink(
    whatsapp,
    `Assalamu alaikum. Please find ${title} ${number} from Zahir Enterprise.`,
  );

  useEffect(() => {
    if (!share || !date) return;
    let current = true;
    fetch(`${url}?date=${date}`)
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (current && blob)
          setFile({
            date,
            file: new File([blob], fileName, { type: "application/pdf" }),
          });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [share, url, date, fileName]);

  // Records the send (SPEC §13.2 POST); the response is the PDF for a
  // Download, empty for a Share.
  async function record(via: SendVia): Promise<Response | null> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, via }),
    }).catch(() => null);
    if (response?.ok) return response;
    setError(
      (response?.status === 409 && (await response.text())) ||
        `Couldn't record the ${verb.toLowerCase()}. Try again.`,
    );
    return null;
  }

  async function download() {
    setBusy(true);
    setError(null);
    const response = await record("download");
    if (response) {
      save(await response.blob(), fileName);
      router.refresh();
      onSent(`Downloaded ${fileName}`);
    }
    setBusy(false);
  }

  async function shareFile() {
    if (file?.date !== date) return;
    setBusy(true);
    setError(null);
    try {
      await navigator.share({ files: [file.file], title: number });
    } catch (cause) {
      // Closing the sheet changes nothing (SPEC §6.3).
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setError("Couldn't open the share sheet. Try again.");
      setBusy(false);
      return;
    }
    if (await record("share")) {
      router.refresh();
      onSent(`${number} shared`);
    }
    setBusy(false);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-surface p-6 shadow-overlay">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-semibold text-navy num">
                {verb} {number}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ink-muted">
                {title} to {recipient}
                {needsResend && " · order changed since it was last sent"}
                {!needsResend && sentAt && ` · already sent ${sentAt}`}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                disabled={busy}
              >
                <X strokeWidth={1.5} />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="document-date" className="text-ink-muted">
              {title} date
            </Label>
            <Input
              id="document-date"
              type="date"
              required
              value={date}
              disabled={locked || busy}
              onChange={(event) => setDate(event.target.value)}
            />
            {locked && (
              <p className="text-xs text-ink-subtle">
                Dates are locked with the order.
              </p>
            )}
          </div>

          {warnings.length > 0 && (
            <ul
              aria-label="Warnings"
              className="flex flex-col gap-1.5 rounded-lg bg-(--status-invoiced-bg) px-3 py-2.5 text-sm text-warning"
            >
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          {share ? (
            <Button
              className="w-full"
              disabled={busy || !date || file?.date !== date}
              onClick={shareFile}
            >
              {busy
                ? "Opening share sheet…"
                : file?.date === date
                  ? "Share PDF"
                  : "Preparing PDF…"}
            </Button>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              {chat && (
                <Button variant="secondary" asChild>
                  <a href={chat} target="_blank" rel="noreferrer">
                    <MessageCircle strokeWidth={1.75} /> Open WhatsApp chat
                  </a>
                </Button>
              )}
              <Button disabled={busy || !date} onClick={download}>
                {busy ? "Downloading…" : "Download PDF"}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function save(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// DESIGN §7b feedback: a toast after each send. One for the whole panel,
// so a new one replaces the last.
let toast: { message: string } | null = null;
const toastListeners = new Set<() => void>();

function setToast(next: { message: string } | null) {
  toast = next;
  toastListeners.forEach((listener) => listener());
}

export function SendToast() {
  const current = useSyncExternalStore(
    (onChange) => {
      toastListeners.add(onChange);
      return () => toastListeners.delete(onChange);
    },
    () => toast,
    () => null,
  );
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      if (toast === current) setToast(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [current]);
  if (!current) return null;
  return (
    <div
      role="status"
      className="fixed top-[calc(env(safe-area-inset-top)+64px)] left-1/2 z-50 flex -translate-x-1/2 animate-in items-center gap-2 rounded-lg bg-navy px-4 py-3 text-sm text-white shadow-overlay duration-200 ease-out fade-in-0 slide-in-from-top-2 motion-reduce:slide-in-from-top-0 md:top-auto md:right-6 md:bottom-6 md:left-auto md:translate-x-0 md:slide-in-from-bottom-2 md:motion-reduce:slide-in-from-bottom-0"
    >
      <CircleCheck className="size-4" />
      {current.message}
    </div>
  );
}
