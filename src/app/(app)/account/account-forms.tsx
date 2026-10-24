"use client";

import { useActionState } from "react";
import { changePasswordAction, updateNameAction } from "@/actions/account";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateNameAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <h3 className="section-label">Name</h3>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="fullName" className="sr-only">
            Name
          </Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={name}
            autoComplete="name"
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Save name
        </Button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <h3 className="section-label">Change password</h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Change password"}
      </Button>
      <FormNotice state={state} />
    </form>
  );
}
