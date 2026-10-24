import "server-only";
import { eq } from "drizzle-orm";
import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import type { Role } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// The single way server code reads the signed-in User. Verifies the session
// token, then the profile: no profile or a deactivated one counts as signed
// out and redirects to /login. Reads the request, so callers in a render sit
// behind <Suspense> (Cache Components). Never cached across requests: token
// expiry and is_active are checked on every one.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  if (!profile?.isActive) redirect("/login");

  return {
    id: profile.id,
    name: profile.fullName,
    email: profile.email,
    role: profile.role,
  };
});

// Guards a page or Server Action: the signed-in User must hold one of the
// roles (usually from PERMISSIONS in src/lib/permissions.ts), else 403.
export async function requireRole(
  ...roles: readonly Role[]
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) forbidden();
  return user;
}
