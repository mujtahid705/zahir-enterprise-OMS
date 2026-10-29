import type { Metadata } from "next";
import { RoleGate } from "@/components/role-gate";
import { FormSkeleton } from "@/components/skeletons";
import { PERMISSIONS } from "@/lib/permissions";
import { NewUserForm } from "./new-user-form";

export const metadata: Metadata = { title: "Add User" };

export default function NewUserPage() {
  return (
    <section className="flex max-w-md flex-col gap-2">
      <h2 className="text-lg font-semibold text-navy">Add User</h2>
      <p className="text-ink-muted">
        Set a temporary password and give it to the User. They can change it on
        their Account page.
      </p>
      <RoleGate
        roles={PERMISSIONS.manageUsers}
        fallback={<FormSkeleton fields={4} />}
      >
        <NewUserForm />
      </RoleGate>
    </section>
  );
}
