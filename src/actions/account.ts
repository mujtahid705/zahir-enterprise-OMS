"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { field, formAction, type FormState } from "@/lib/form-state";
import { supabaseAuthAdmin } from "@/lib/supabase/admin";
import { changeOwnPassword, updateOwnName } from "@/services/users";

// Every User manages their own name and password (SPEC §9 /account).

export async function updateNameAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const state = await formAction(
    () => updateOwnName(user, field(formData, "fullName")),
    "Name saved.",
  );
  refresh();
  return state;
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (formData.get("password") !== formData.get("confirm")) {
    return { error: "The new passwords don't match." };
  }
  return formAction(
    () =>
      changeOwnPassword(
        user,
        field(formData, "current"),
        field(formData, "password"),
        { auth: supabaseAuthAdmin },
      ),
    "Password changed.",
  );
}
