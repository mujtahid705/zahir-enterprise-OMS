"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { field, formAction, type FormState } from "@/lib/form-state";
import { PERMISSIONS, type Role } from "@/lib/permissions";
import { supabaseAuthAdmin } from "@/lib/supabase/admin";
import {
  changeRole,
  createUser,
  resetPassword,
  setActive,
} from "@/services/users";

// User management, Admin only (SPEC §3). The service checks the role again.

const asAdmin = () => requireRole(...PERMISSIONS.manageUsers);

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asAdmin();
  let id = "";
  const state = await formAction(async () => {
    id = await createUser(
      actor,
      {
        fullName: field(formData, "fullName"),
        email: field(formData, "email"),
        role: field(formData, "role") as Role,
        password: field(formData, "password"),
      },
      { auth: supabaseAuthAdmin },
    );
  });
  if (state?.error) return state;
  redirect(`/settings/users/${id}`);
}

export async function changeRoleAction(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asAdmin();
  const state = await formAction(
    () => changeRole(actor, userId, field(formData, "role") as Role),
    "Role saved.",
  );
  refresh();
  return state;
}

export async function setActiveAction(
  userId: string,
  isActive: boolean,
): Promise<FormState> {
  const actor = await asAdmin();
  const state = await formAction(
    () => setActive(actor, userId, isActive),
    isActive ? "User reactivated." : "User deactivated.",
  );
  refresh();
  return state;
}

export async function resetPasswordAction(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await asAdmin();
  return formAction(
    () =>
      resetPassword(actor, userId, field(formData, "password"), {
        auth: supabaseAuthAdmin,
      }),
    "Password set. Give it to the User and ask them to change it.",
  );
}
