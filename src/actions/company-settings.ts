"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { CompanyImageKind } from "@/lib/company-image";
import { field, formAction, type FormState } from "@/lib/form-state";
import { PERMISSIONS } from "@/lib/permissions";
import { supabaseCompanyAssets } from "@/lib/supabase/admin";
import {
  replaceCompanyImage,
  updateCompanyDetails,
} from "@/services/company-settings";

// Company settings, Admin only (SPEC §12). The service checks the role again.

const asAdmin = () => requireRole(...PERMISSIONS.editCompanySettings);

export async function updateCompanyDetailsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asAdmin();
  const state = await formAction(
    () =>
      updateCompanyDetails(actor, {
        name: field(formData, "name"),
        address: field(formData, "address"),
        phone: field(formData, "phone"),
        email: field(formData, "email"),
        paymentInstructions: field(formData, "paymentInstructions"),
        defaultWoNote: field(formData, "defaultWoNote"),
      }),
    "Company details saved.",
  );
  refresh();
  return state;
}

export async function uploadCompanyImageAction(
  kind: CompanyImageKind,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const state = await formAction(
    () =>
      replaceCompanyImage(actor, kind, bytes, {
        storage: supabaseCompanyAssets,
      }),
    kind === "logo" ? "Logo saved." : "Signature saved.",
  );
  refresh();
  return state;
}
