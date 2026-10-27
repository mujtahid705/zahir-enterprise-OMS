"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { formAction, type FormState } from "@/lib/form-state";
import type { OrderInput } from "@/lib/orders";
import { PERMISSIONS } from "@/lib/permissions";
import { productInputFrom } from "@/actions/product-input";
import { orders, type ProductOption } from "@/services/orders";
import { products } from "@/services/products";

// Orders (SPEC §3): every role creates them. The service checks the role
// again and validates the input, which comes straight from the browser.

const asEditor = () => requireRole(...PERMISSIONS.editOrders);

// The product sheet's list, loaded once a Customer is picked.
export async function orderProductsAction(
  customerId: string,
): Promise<ProductOption[]> {
  const actor = await asEditor();
  if (!z.uuid().safeParse(customerId).success) return [];
  return orders.productOptions(actor, customerId);
}

// "+ New product for this customer" (SPEC §5.2, Admin/Manager): saves the
// Product and hands back the refreshed list with the new one to add.
export async function createOrderProductAction(
  customerId: string,
  formData: FormData,
): Promise<
  { error: string } | { product: ProductOption; products: ProductOption[] }
> {
  const actor = await requireRole(...PERMISSIONS.addProductInline);
  let id = "";
  const state = await formAction(async () => {
    ({ id } = await products.create(actor, {
      ...productInputFrom(formData),
      customerId,
    }));
  });
  if (state?.error) return { error: state.error };
  const options = await orders.productOptions(actor, customerId);
  const product = options.find((option) => option.id === id);
  // Saved, but its Customer was deactivated meanwhile: say so, so it isn't
  // added twice.
  if (!product)
    return {
      error:
        "The Product was saved, but this Customer is no longer active, so it can't go on this Order.",
    };
  return { product, products: options };
}

export async function createOrderAction(input: OrderInput): Promise<FormState> {
  const actor = await asEditor();
  let id = "";
  const state = await formAction(async () => {
    ({ id } = await orders.create(actor, input));
  });
  if (state?.error) return state;
  redirect(`/orders/${id}`);
}
