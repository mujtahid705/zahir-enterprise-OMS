import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// Creates auth users plus their profiles. Profiles are written as the system
// actor (ADR 0001); a real User's later edits go through withUser.

export type SeedUser = {
  email: string;
  fullName: string;
  role: "admin" | "manager" | "staff";
  password: string;
  isActive?: boolean;
};

// "skip" leaves an existing User alone; "sync" resets its password, role and
// active flag to the given values (for E2E users).
export async function seedUsers(
  users: SeedUser[],
  { onExisting }: { onExisting: "skip" | "sync" },
): Promise<void> {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const sql = postgres(requireEnv("DIRECT_DATABASE_URL"), {
    prepare: false,
    max: 1,
  });

  try {
    for (const user of users) {
      const isActive = user.isActive ?? true;
      const [existing] = await sql<{ id: string }[]>`
        select id from profiles where email = ${user.email}`;

      if (existing) {
        if (onExisting === "skip") continue;
        const { error } = await supabase.auth.admin.updateUserById(
          existing.id,
          { password: user.password },
        );
        if (error) throw error;
        await sql.begin(async (tx) => {
          await tx`select set_config('app.actor', 'system', true)`;
          await tx`
            update profiles
            set full_name = ${user.fullName}, role = ${user.role}, is_active = ${isActive}
            where id = ${existing.id}`;
        });
        continue;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });
      if (error) {
        throw new Error(
          `Could not create ${user.email}: ${error.message}. If the auth user exists without a profile, add the profile or delete the auth user first.`,
        );
      }
      await sql.begin(async (tx) => {
        await tx`select set_config('app.actor', 'system', true)`;
        await tx`
          insert into profiles (id, email, full_name, role, is_active)
          values (${data.user.id}, ${user.email}, ${user.fullName}, ${user.role}, ${isActive})`;
      });
    }
  } finally {
    await sql.end();
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}
