"use client";

import { CircleCheck, LockOpen, RotateCcw, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useActionState, useId, useState, type ReactNode } from "react";
import {
  cancelOrderAction,
  changeOrderStatusAction,
  restoreOrderAction,
  unlockOrderAction,
} from "@/actions/orders";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

// The Order page's manual status controls (SPEC §5.5, §6.4). The server
// checks every role again; these only offer what the role may do.
// `updatedAt` is the Order as the page loaded it.

type OrderVersion = { orderId: string; updatedAt: string | null };

// Change status: the steps statusTargets offers this role, with an
// optional note for the history.
export function ChangeStatus({
  orderId,
  updatedAt,
  targets,
}: OrderVersion & { targets: readonly OrderStatus[] }) {
  const [state, action, pending] = useActionState(
    changeOrderStatusAction.bind(null, orderId, updatedAt),
    undefined,
  );
  const id = useId();
  return (
    <form
      action={action}
      aria-label="Change status"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5 sm:w-44">
          <Label htmlFor={`${id}-to`} className="text-ink-muted">
            Change status to
          </Label>
          <NativeSelect id={`${id}-to`} name="to" required defaultValue="">
            <option value="" disabled>
              Pick a status
            </option>
            {targets.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABEL[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`${id}-note`} className="text-ink-muted">
            Note (optional)
          </Label>
          <Input id={`${id}-note`} name="note" maxLength={500} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          Change status
        </Button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}

// Mark Completed (Admin/Manager): the customer and supplier are paid.
export function MarkCompleted({ orderId, updatedAt }: OrderVersion) {
  const [state, action, pending] = useActionState(
    changeOrderStatusAction.bind(null, orderId, updatedAt),
    undefined,
  );
  const formId = useId();
  return (
    <form id={formId} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="to" value="completed" />
      <ConfirmDialog
        formId={formId}
        title="Mark this order Completed?"
        description="Use this once the customer has paid and the supplier is paid. The order stays locked."
        confirmLabel="Mark Completed"
        trigger={
          <Button type="button" disabled={pending}>
            <CircleCheck strokeWidth={1.5} />
            Mark Completed
          </Button>
        }
      />
      <FormNotice state={state} />
    </form>
  );
}

// Cancel (Admin/Manager), with its required reason.
export function CancelOrder({ orderId, updatedAt }: OrderVersion) {
  return (
    <ReasonDialog
      run={cancelOrderAction.bind(null, orderId, updatedAt)}
      title="Cancel this order?"
      description="Sent Work Orders are cancelled too, so their suppliers need telling. The order can be restored later."
      label="Reason for cancelling"
      confirmLabel="Cancel order"
      destructive
      trigger={
        <Button type="button" variant="outline">
          <X strokeWidth={1.5} />
          Cancel order
        </Button>
      }
    />
  );
}

// Admin's Unlock, in the lock strip (DESIGN §7b), with its required reason.
export function UnlockOrder({ orderId, updatedAt }: OrderVersion) {
  return (
    <ReasonDialog
      run={unlockOrderAction.bind(null, orderId, updatedAt)}
      title="Unlock this order?"
      description="Its document dates can be changed again. Check the Invoice before sending it again; sending it locks the order."
      label="Reason for unlocking"
      confirmLabel="Unlock"
      trigger={
        <Button type="button" variant="outline" size="sm">
          <LockOpen strokeWidth={1.5} />
          Unlock
        </Button>
      }
    />
  );
}

// Restore (Admin/Manager): back to the status it had before cancelling.
export function RestoreOrder({ orderId, updatedAt }: OrderVersion) {
  const [state, action, pending] = useActionState(
    () => restoreOrderAction(orderId, updatedAt),
    undefined,
  );
  const formId = useId();
  return (
    <form id={formId} action={action} className="flex flex-col gap-2">
      <ConfirmDialog
        formId={formId}
        title="Restore this order?"
        description="It goes back to the status it had, and its cancelled Work Orders count as sent again."
        confirmLabel="Restore"
        trigger={
          <Button type="button" variant="outline" size="sm" disabled={pending}>
            <RotateCcw strokeWidth={1.5} />
            Restore
          </Button>
        }
      />
      <FormNotice state={state} />
    </form>
  );
}

// A dialog asking for a reason before running the action; it closes once
// the action succeeds and keeps the error in view if not.
function ReasonDialog({
  run,
  title,
  description,
  label,
  confirmLabel,
  destructive = false,
  trigger,
}: {
  run: (state: FormState, formData: FormData) => Promise<FormState>;
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  destructive?: boolean;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const next = await run(previous, formData);
      if (!next?.error) setOpen(false);
      return next;
    },
    undefined,
  );
  const id = useId();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-surface p-6 shadow-overlay">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-lg font-semibold text-navy">
              {title}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-ink-muted">
              {description}
            </Dialog.Description>
          </div>
          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id} className="text-ink-muted">
                {label}
              </Label>
              <Textarea id={id} name="reason" required maxLength={500} />
            </div>
            <FormNotice state={state?.error ? state : undefined} />
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={pending}>
                  Back
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                variant={destructive ? "destructive" : "default"}
                disabled={pending}
              >
                {confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
