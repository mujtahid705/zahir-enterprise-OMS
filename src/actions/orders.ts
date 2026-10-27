"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { formAction, type FormState } from "@/lib/form-state";
import type { OrderInput } from "@/lib/orders";
import { PERMISSIONS } from "@/lib/permissions";
import { orders, type ProductOption } from "@/services/orders";

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

export async function createOrderAction(input: OrderInput): Promise<FormState> {
  const actor = await asEditor();
  let id = "";
  const state = await formAction(async () => {
    ({ id } = await orders.create(actor, input));
  });
  if (state?.error) return state;
  redirect(`/orders/${id}`);
}
