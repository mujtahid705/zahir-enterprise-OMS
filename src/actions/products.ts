"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { field, formAction, type FormState } from "@/lib/form-state";
import type { ProductEditInput } from "@/lib/products";
import { PERMISSIONS } from "@/lib/permissions";
import { products } from "@/services/products";

// Products (SPEC §3): Admin/Manager write, Admin deletes. The service checks
// the role again.

const asEditor = () => requireRole(...PERMISSIONS.manageMasterData);

function inputFrom(formData: FormData): ProductEditInput {
  return {
    supplierId: field(formData, "supplierId"),
    name: field(formData, "name"),
    size: field(formData, "size"),
    thickness: field(formData, "thickness"),
    colour: field(formData, "colour"),
    printDetails: field(formData, "printDetails"),
    description: field(formData, "description"),
    sellPrice: field(formData, "sellPrice"),
    buyPrice: field(formData, "buyPrice"),
  };
}

export async function createProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asEditor();
  let id = "";
  const state = await formAction(async () => {
    ({ id } = await products.create(actor, {
      ...inputFrom(formData),
      customerId: field(formData, "customerId"),
    }));
  });
  if (state?.error) return state;
  redirect(`/products/${id}`);
}

export async function updateProductAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asEditor();
  const state = await formAction(() =>
    products.update(actor, id, inputFrom(formData)),
  );
  if (state?.error) return state;
  redirect(`/products/${id}`);
}

export async function duplicateProductAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asEditor();
  let copyId = "";
  const state = await formAction(async () => {
    ({ id: copyId } = await products.duplicate(actor, id, {
      customerId: field(formData, "customerId"),
      sellPrice: field(formData, "sellPrice"),
      buyPrice: field(formData, "buyPrice"),
    }));
  });
  if (state?.error) return state;
  redirect(`/products/${copyId}`);
}

export async function setProductActiveAction(
  id: string,
  isActive: boolean,
): Promise<FormState> {
  const actor = await asEditor();
  const state = await formAction(
    () => products.setActive(actor, id, isActive),
    isActive ? "Product reactivated." : "Product deactivated.",
  );
  refresh();
  return state;
}

export async function deleteProductAction(id: string): Promise<FormState> {
  const actor = await requireRole(...PERMISSIONS.deleteMasterData);
  const state = await formAction(() => products.remove(actor, id));
  if (state?.error) return state;
  redirect("/products");
}
