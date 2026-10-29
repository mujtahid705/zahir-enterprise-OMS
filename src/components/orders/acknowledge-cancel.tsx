"use client";

import { useActionState } from "react";
import { acknowledgeCancelAction } from "@/actions/orders";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";

// The Done button of a cancelled Work Order (SPEC §6.2, DESIGN §7b): the
// Supplier has been told.
export function AcknowledgeCancel({
  orderId,
  workOrderId,
  woNo,
}: {
  orderId: string;
  workOrderId: string;
  woNo: string;
}) {
  const [state, action, pending] = useActionState(
    () => acknowledgeCancelAction(orderId, workOrderId),
    undefined,
  );
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        aria-label={`Done: supplier told ${woNo} is cancelled`}
      >
        Done
      </Button>
      <FormNotice state={state} />
    </form>
  );
}
