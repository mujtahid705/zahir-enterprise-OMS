"use client";

import { useActionState } from "react";
import { createUserAction } from "@/actions/users";
import { FormNotice } from "@/components/form-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleSelect } from "../role-select";

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUserAction, undefined);

  return (
    <form action={action} className="mt-4 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Name</Label>
        <Input id="fullName" name="fullName" autoComplete="off" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <RoleSelect id="role" name="role" defaultValue="staff" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Temporary password</Label>
        <Input
          id="password"
          name="password"
          type="text"
          autoComplete="off"
          minLength={8}
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Adding…" : "Add User"}
      </Button>
      <FormNotice state={state} />
    </form>
  );
}
