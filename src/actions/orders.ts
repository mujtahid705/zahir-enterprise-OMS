"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { formAction, type FormState } from "@/lib/form-state";
import type { OrderEditInput, OrderInput } from "@/lib/orders";
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

const GONE = { error: "This order no longer exists." };

// Saves the edit form (SPEC §5.5); a conflicting save comes back as the
// form's error.
export async function updateOrderAction(
  id: string,
  input: OrderEditInput,
): Promise<FormState> {
  const actor = await asEditor();
  let found = true;
  const state = await formAction(async () => {
    found = !!(await orders.update(actor, id, input));
  });
  if (state?.error) return state;
  if (!found) return GONE;
  redirect(`/orders/${id}`);
}

// "Refresh prices from products" on the Order page (SPEC §5.3).
export async function refreshOrderPricesAction(
  id: string,
  updatedAt: string | null,
): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.overridePrices);
  let found = true;
  const state = await formAction(async () => {
    found = !!(await orders.refreshPrices(actor, id, { updatedAt }));
  }, "Prices refreshed from the products.");
  if (!found) return GONE;
  refresh();
  return state;
}

// "Done" on a cancelled Work Order: its Supplier was told (SPEC §6.2).
export async function acknowledgeCancelAction(
  orderId: string,
  workOrderId: string,
): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.shareDocuments);
  let found = true;
  const state = await formAction(async () => {
    found = !!(await orders.acknowledgeCancel(actor, orderId, workOrderId));
  });
  if (!found) return GONE;
  refresh();
  return state;
}
