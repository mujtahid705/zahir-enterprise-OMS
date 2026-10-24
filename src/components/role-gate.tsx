import { Suspense, type ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/permissions";

// Wraps a section's layout: renders it only for the given roles, otherwise
// the (app) forbidden page. The check reads the session, so it streams.
export function RoleGate({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  return (
    <Suspense>
      <Gate roles={roles}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  await requireRole(...roles);
  return children;
}
