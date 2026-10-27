"use client";

import { useActionState } from "react";
import { createOrderProductAction } from "@/actions/orders";
import {
  Specs,
  ValidatedForm,
  type Option,
} from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { productEditSchema } from "@/lib/products";
import type { ProductOption } from "@/services/orders";

// "+ New product for this customer" on the order form (SPEC §5.2): the
// Customer is the order's, and the saved Product goes straight to the order.
export function OrderProductForm({
  customerId,
  suppliers,
  onCreated,
}: {
  customerId: string;
  suppliers: Option[];
  onCreated: (created: {
    product: ProductOption;
    products: ProductOption[];
  }) => void;
}) {
  const [state, action, pending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      const result = await createOrderProductAction(customerId, formData);
      if ("error" in result) return result;
      onCreated(result);
      return undefined;
    },
    undefined,
  );
  return (
    <ValidatedForm action={action} schema={productEditSchema} state={state}>
      <Specs suppliers={suppliers} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add Product"}
      </Button>
    </ValidatedForm>
  );
}
