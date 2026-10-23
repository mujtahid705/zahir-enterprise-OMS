import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { profiles } from "@/db/schema";
import type { Actor } from "@/db/with-user";

// Runs fn as the migration/seed actor, then drops back to no actor so the
// rest of the test still has to go through withUser.
export async function asSystem<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  await tx.execute(sql`select set_config('app.actor', 'system', true)`);
  const result = await fn();
  await tx.execute(sql`select set_config('app.actor', '', true)`);
  return result;
}

// An auth user plus profile, created by the system actor.
export async function createUser(
  tx: Tx,
  fields: Partial<typeof profiles.$inferInsert> = {},
): Promise<Actor> {
  const id = randomUUID();
  const email = `${id}@test.ze`;
  const fullName = fields.fullName ?? "Test User";
  await tx.execute(
    sql`insert into auth.users (id, email) values (${id}, ${email})`,
  );
  await asSystem(tx, () =>
    tx
      .insert(profiles)
      .values({ id, email, fullName, role: "staff", ...fields }),
  );
  return { id, name: fullName };
}
