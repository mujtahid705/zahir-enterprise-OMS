"use client";

import { useActionState } from "react";
import {
  changeRoleAction,
  resetPasswordAction,
  setActiveAction,
} from "@/actions/users";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Role } from "@/lib/permissions";
import { RoleSelect } from "../role-select";

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-3 section-label">{children}</h3>;
}

export function RoleForm({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: Role;
}) {
  const [state, action, pending] = useActionState(
    changeRoleAction.bind(null, userId),
    undefined,
  );
  return (
    <form id="role-form" action={action} className="flex flex-col gap-3">
      <SectionTitle>Role</SectionTitle>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="role" className="sr-only">
            Role
          </Label>
          <RoleSelect id="role" name="role" defaultValue={role} />
        </div>
        <ConfirmDialog
          formId="role-form"
          title={`Change ${name}'s role?`}
          description="What they can see and do changes on their next page load."
          confirmLabel="Change role"
          trigger={
            <Button type="button" variant="outline" disabled={pending}>
              Save role
            </Button>
          }
        />
      </div>
      <FormNotice state={state} />
    </form>
  );
}

// Deactivating is confirmed in a dialog (SPEC §9); reactivating isn't.
export function ActiveForm({
  userId,
  name,
  isActive,
}: {
  userId: string;
  name: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(
    setActiveAction.bind(null, userId, !isActive),
    undefined,
  );

  return (
    <form id="active-form" action={action} className="flex flex-col gap-3">
      <SectionTitle>Access</SectionTitle>
      {isActive ? (
        <ConfirmDialog
          formId="active-form"
          destructive
          title={`Deactivate ${name}?`}
          description="They can't sign in until reactivated. Their name stays on past records."
          confirmLabel="Deactivate"
          trigger={
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={pending}
            >
              Deactivate User
            </Button>
          }
        />
      ) : (
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={pending}
        >
          Reactivate User
        </Button>
      )}
      <FormNotice state={state} />
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction.bind(null, userId),
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <SectionTitle>Reset password</SectionTitle>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="new-password" className="sr-only">
            New temporary password
          </Label>
          <Input
            id="new-password"
            name="password"
            type="text"
            autoComplete="off"
            placeholder="New temporary password"
            minLength={8}
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={pending}>
          Set password
        </Button>
      </div>
      <FormNotice state={state} />
    </form>
  );
}
