import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { PERMISSIONS, ROLE_LABEL } from "@/lib/permissions";
import { getUser } from "@/services/users";
import { DeactivatedBadge } from "../deactivated-badge";
import { ActiveForm, ResetPasswordForm, RoleForm } from "./user-forms";

export const metadata: Metadata = { title: "User" };

export default function UserPage({
  params,
}: PageProps<"/settings/users/[id]">) {
  return (
    <Suspense>
      <UserDetail params={params} />
    </Suspense>
  );
}

async function UserDetail({
  params,
}: Pick<PageProps<"/settings/users/[id]">, "params">) {
  const { id } = await params;
  const actor = await requireRole(...PERMISSIONS.manageUsers);
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getUser(actor, id);
  if (!user) notFound();
  const isSelf = user.id === actor.id;

  return (
    <section className="flex max-w-md flex-col gap-8">
      <div>
        <Link
          href="/settings/users"
          className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-navy"
        >
          <ChevronLeft className="size-4" strokeWidth={1.5} />
          Users
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
          {user.fullName}
          {!user.isActive && <DeactivatedBadge />}
        </h2>
        <p className="text-ink-muted">
          {user.email} · {ROLE_LABEL[user.role]}
        </p>
      </div>

      {isSelf ? (
        <p className="text-sm text-ink-muted">
          This is you. Another Admin has to change your role or deactivate you;
          change your own name and password on your{" "}
          <Link href="/account" className="text-navy underline">
            Account
          </Link>{" "}
          page.
        </p>
      ) : (
        <>
          <RoleForm userId={user.id} name={user.fullName} role={user.role} />
          <ActiveForm
            userId={user.id}
            name={user.fullName}
            isActive={user.isActive}
          />
          <ResetPasswordForm userId={user.id} />
        </>
      )}
    </section>
  );
}
