"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormNotice } from "@/components/form-notice";

// Shown when /auth/confirm rejects a reset link.
export function ExpiredLinkNotice() {
  if (!useSearchParams().has("expired")) return null;
  return (
    <p role="alert" className="mt-6 text-sm text-danger">
      That link has expired or was already used. Request a new one.
    </p>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <FormNotice state={state} />
      <Link
        href="/login"
        className="text-sm text-ink-muted underline-offset-4 hover:text-navy hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}
