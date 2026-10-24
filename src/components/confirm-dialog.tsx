"use client";

import { AlertDialog } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

// Confirms a destructive or status-changing action (SPEC §9). `trigger` opens
// it; Confirm submits the form with id `formId`.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  formId,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  formId: string;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-surface p-6 shadow-overlay">
          <AlertDialog.Title className="text-lg font-semibold text-navy">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-ink-muted">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                type="button"
                variant={destructive ? "destructive" : "default"}
                // Submit before the dialog closes and unmounts this button.
                onClick={() => {
                  const form = document.getElementById(formId);
                  if (form instanceof HTMLFormElement) form.requestSubmit();
                }}
              >
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
