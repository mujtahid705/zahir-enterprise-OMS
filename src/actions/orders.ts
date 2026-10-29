"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { field, formAction, type FormState } from "@/lib/form-state";
import type { OrderEditInput, OrderInput } from "@/lib/orders";
import { PERMISSIONS } from "@/lib/permissions";
import { productInputFrom } from "@/actions/product-input";
import { orderStatus } from "@/services/order-status";
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

// The Order page's status controls (SPEC §5.5, §6.4). `updatedAt` is the
// Order as the page loaded it; a stale page comes back as the form's error.
async function statusAction(
  run: () => Promise<unknown>,
  message: string,
): Promise<FormState> {
  let found = true;
  const state = await formAction(async () => {
    found = !!(await run());
  }, message);
  if (state?.error) return state;
  if (!found) return GONE;
  refresh();
  return state;
}

export async function changeOrderStatusAction(
  id: string,
  updatedAt: string | null,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.changeStatusForward);
  return statusAction(
    () =>
      orderStatus.change(actor, id, {
        to: field(formData, "to"),
        note: field(formData, "note"),
        updatedAt,
      }),
    "Status changed.",
  );
}

export async function cancelOrderAction(
  id: string,
  updatedAt: string | null,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.completeOrCancel);
  return statusAction(
    () =>
      orderStatus.cancel(actor, id, {
        reason: field(formData, "reason"),
        updatedAt,
      }),
    "Order cancelled.",
  );
}

export async function restoreOrderAction(
  id: string,
  updatedAt: string | null,
): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.completeOrCancel);
  return statusAction(
    () => orderStatus.restore(actor, id, { updatedAt }),
    "Order restored.",
  );
}

export async function unlockOrderAction(
  id: string,
  updatedAt: string | null,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.unlockOrder);
  return statusAction(
    () =>
      orderStatus.unlock(actor, id, {
        reason: field(formData, "reason"),
        updatedAt,
      }),
    "Order unlocked.",
  );
}
