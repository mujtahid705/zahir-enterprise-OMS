import type { Metadata } from "next";
import { Suspense } from "react";
import { TopBar } from "@/components/shell/top-bar";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/permissions";
import { NameForm, PasswordForm } from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <>
      <TopBar title="Account" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <Account />
        </Suspense>
      </main>
    </>
  );
}

async function Account() {
  const user = await getCurrentUser();
  return (
    <section className="flex max-w-md flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-navy">{user.name}</h2>
        <p className="text-ink-muted">
          {user.email} · {ROLE_LABEL[user.role]}
        </p>
      </div>
      <NameForm name={user.name} />
      <PasswordForm />
    </section>
  );
}
