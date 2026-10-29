"use client";

import { useActionState, useId } from "react";
import { RefreshCw } from "lucide-react";
import { refreshOrderPricesAction } from "@/actions/orders";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";

// "Refresh prices from products" (SPEC §5.3), Admin/Manager on an editable
// Order. `updatedAt` is the Order as this page loaded it (SPEC §5.5).
export function RefreshPrices({
  orderId,
  updatedAt,
}: {
  orderId: string;
  updatedAt: string | null;
}) {
  const [state, action, pending] = useActionState(
    () => refreshOrderPricesAction(orderId, updatedAt),
    undefined,
  );
  // ConfirmDialog finds its form by id; unique per mount.
  const formId = useId();
  return (
    <form id={formId} action={action} className="flex flex-col gap-3">
      <ConfirmDialog
        formId={formId}
        title="Refresh prices from products?"
        description="Every line takes its Product's current sell and buy price, replacing any price changed on the line. Suppliers stay as they are; a sent Work Order whose buy prices change will need re-sending."
        confirmLabel="Refresh prices"
        trigger={
          <Button type="button" variant="secondary" disabled={pending}>
            <RefreshCw strokeWidth={1.5} />
            Refresh prices from products
          </Button>
        }
      />
      <FormNotice state={state} />
    </form>
  );
}
