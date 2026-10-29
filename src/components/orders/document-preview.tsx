"use client";

import { Eye, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

// Preview (SPEC §6.3, DESIGN §7b): the rendered PDF in a dialog. It only
// GETs the document, so nothing is marked as sent or logged.
export function DocumentPreview({
  url,
  fileName,
}: {
  url: string;
  fileName: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Preview ${fileName}`}>
          <Eye strokeWidth={1.5} />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-xl bg-surface shadow-overlay md:inset-x-auto md:inset-y-6 md:left-1/2 md:w-full md:max-w-3xl md:-translate-x-1/2">
          <div className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-semibold text-navy">
                {fileName}
              </Dialog.Title>
              <Dialog.Description className="text-xs text-ink-muted">
                Preview only. Not marked as sent.{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-navy underline-offset-4 hover:underline"
                >
                  Open in a new tab
                </a>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X strokeWidth={1.5} />
              </Button>
            </Dialog.Close>
          </div>
          <iframe
            src={url}
            title={fileName}
            className="min-h-0 w-full flex-1 bg-canvas"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
