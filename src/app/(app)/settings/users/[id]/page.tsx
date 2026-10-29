import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { PERMISSIONS, ROLE_LABEL, can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getUser } from "@/services/users";
import {
  RecordHistory,
  RecordTabs,
  historyTab,
} from "@/components/activity/record-history";
import { DeactivatedBadge } from "@/components/deactivated-badge";
import { ActiveForm, ResetPasswordForm, RoleForm } from "./user-forms";

export const metadata: Metadata = { title: "User" };

export default function UserPage({
  params,
  searchParams,
}: PageProps<"/settings/users/[id]">) {
  return (
    <Suspense>
      <UserDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function UserDetail({
  params,
  searchParams,
}: PageProps<"/settings/users/[id]">) {
  const { id } = await params;
  const actor = await requireRole(...PERMISSIONS.manageUsers);
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await getUser(actor, id);
  if (!user) notFound();
  const isSelf = user.id === actor.id;
  const { history, page } = historyTab(actor, await searchParams);
  const href = `/settings/users/${user.id}`;

  return (
    <section
      className={cn("flex flex-col gap-8", history ? "max-w-3xl" : "max-w-md")}
    >
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

      {can(actor.role, "viewActivityLog") && (
        <RecordTabs
          label="User"
          tabs={[
            { value: "details", label: "Details" },
            { value: "history", label: "History" },
          ]}
          current={history ? "history" : "details"}
          href={(tab) => (tab === "history" ? `${href}?tab=history` : href)}
        />
      )}

      {history ? (
        <RecordHistory
          actor={actor}
          scope={{ entityType: "profiles", entityId: user.id }}
          page={page}
          pageHref={(n) => `${href}?tab=history&page=${n}`}
        />
      ) : isSelf ? (
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
