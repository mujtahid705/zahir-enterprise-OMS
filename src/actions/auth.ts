"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { logEvent } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Sign-in, sign-out and password reset run here, not in the browser client,
// so every one can be logged (SPEC §13.1, §11.1).

export type FormState = { error?: string; message?: string } | undefined;

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Still a failed login: record whatever was typed (SPEC §11.1).
    await logEvent({
      action: "login_failed",
      user: null,
      details: { email: String(formData.get("email") ?? "") },
    });
    return { error: "Enter your email and password." };
  }
  const { email, password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    await logEvent({ action: "login_failed", user: null, details: { email } });
    return {
      error:
        error.code === "invalid_credentials"
          ? "Wrong email or password."
          : "Couldn't sign in. Try again in a minute.",
    };
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, data.user.id),
  });
  if (!profile?.isActive) {
    await supabase.auth.signOut({ scope: "local" });
    await logEvent({
      action: "login_failed",
      user: null,
      details: { email, reason: "deactivated" },
    });
    return { error: "This account is deactivated. Ask an Admin." };
  }

  await logEvent({
    action: "login",
    user: { id: profile.id, name: profile.fullName },
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await logEvent({ action: "logout", user });
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };

  const origin = (await headers()).get("origin");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  // Same answer either way, so the form doesn't reveal who has an account.
  if (error) console.error("Password reset email failed", error);
  return {
    message: "If that email has an account, a reset link is on its way.",
  };
}

const newPassword = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The passwords don't match.",
  });

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = newPassword.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password you haven't used here before."
          : "Couldn't update the password. Try again.",
    };
  }

  await logEvent({ action: "password_reset", user });
  redirect("/");
}
