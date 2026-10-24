import { asc, count, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db, type Db, type Tx } from "@/db/client";
import { profiles } from "@/db/schema";
import { withUser } from "@/db/with-user";
import { logEvent } from "@/lib/activity";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth";
import { ROLES, can, type Permission, type Role } from "@/lib/permissions";

// User management (Admin) and own-account changes (everyone), SPEC §3 and §9.
// Every function checks the acting User's role itself, so a Server Action
// can't skip it. Auth accounts live in Supabase Auth, reached through AuthAdmin.

export interface AuthAdmin {
  createUser(input: {
    email: string;
    password: string;
  }): Promise<{ id: string }>;
  deleteUser(id: string): Promise<void>;
  setPassword(id: string, password: string): Promise<void>;
  verifyPassword(email: string, password: string): Promise<boolean>;
}

type Deps = { executor?: Db | Tx };
type AuthDeps = Deps & { auth: AuthAdmin };

function authorize(actor: CurrentUser, permission: Permission) {
  if (!can(actor.role, permission)) throw new NotAllowedError(permission);
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new UserInputError(result.error.issues[0]!.message);
  return result.data;
}

const fullName = z.string().trim().min(1, "Enter a name.");
const password = z
  .string()
  .min(8, "Use at least 8 characters for the password.");
const role = z.enum(ROLES);

const newUserSchema = z.object({
  fullName,
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role,
  password,
});

export type NewUser = z.input<typeof newUserSchema>;

export const USERS_PAGE_SIZE = 25;

// SPEC §9: every list is searchable and paginated, 25 per page.
export async function listUsers(
  actor: CurrentUser,
  { query = "", page = 1 }: { query?: string; page?: number },
  { executor = db }: Deps = {},
) {
  authorize(actor, "manageUsers");
  const term = `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`;
  const where = or(ilike(profiles.fullName, term), ilike(profiles.email, term));
  const [users, [{ total }]] = await Promise.all([
    executor.query.profiles.findMany({
      where,
      orderBy: [asc(profiles.fullName), asc(profiles.id)],
      limit: USERS_PAGE_SIZE,
      offset: (Math.max(1, page) - 1) * USERS_PAGE_SIZE,
    }),
    executor.select({ total: count() }).from(profiles).where(where),
  ]);
  return { users, total };
}

export async function getUser(
  actor: CurrentUser,
  userId: string,
  { executor = db }: Deps = {},
) {
  authorize(actor, "manageUsers");
  return executor.query.profiles.findFirst({ where: eq(profiles.id, userId) });
}

// Creates the auth account with a temporary password, then the profile. If
// the profile can't be written, the auth account is removed again.
export async function createUser(
  actor: CurrentUser,
  input: NewUser,
  { auth, executor = db }: AuthDeps,
): Promise<string> {
  authorize(actor, "manageUsers");
  const user = parse(newUserSchema, input);

  const existing = await executor.query.profiles.findFirst({
    where: eq(profiles.email, user.email),
  });
  if (existing)
    throw new UserInputError("A User with that email already exists.");

  const { id } = await auth.createUser({
    email: user.email,
    password: user.password,
  });
  try {
    await withUser(
      actor,
      (tx) =>
        tx.insert(profiles).values({
          id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        }),
      executor,
    );
  } catch (error) {
    // Keep the original error even if the clean-up fails too.
    await auth
      .deleteUser(id)
      .catch((cleanup) => console.error(`Orphaned auth user ${id}`, cleanup));
    throw error;
  }
  return id;
}

export async function changeRole(
  actor: CurrentUser,
  userId: string,
  newRole: Role,
  { executor = db }: Deps = {},
): Promise<void> {
  authorize(actor, "manageUsers");
  if (userId === actor.id)
    throw new UserInputError("You can't change your own role.");
  await updateProfile(actor, userId, { role: parse(role, newRole) }, executor);
}

export async function setActive(
  actor: CurrentUser,
  userId: string,
  isActive: boolean,
  { executor = db }: Deps = {},
): Promise<void> {
  authorize(actor, "manageUsers");
  if (userId === actor.id && !isActive) {
    throw new UserInputError("You can't deactivate yourself.");
  }
  await updateProfile(actor, userId, { isActive }, executor);
}

// Admin sets a new temporary password for another User.
export async function resetPassword(
  actor: CurrentUser,
  userId: string,
  newPassword: string,
  { auth, executor = db }: AuthDeps,
): Promise<void> {
  authorize(actor, "manageUsers");
  const value = parse(password, newPassword);
  const target = await executor.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  if (!target) throw new UserInputError("That User doesn't exist.");

  // Log first in a transaction, then set: if either fails, neither stands
  // (SPEC §11.3).
  await executor.transaction(async (tx) => {
    await logEvent(
      {
        action: "password_reset",
        user: actor,
        entity: { type: "profiles", id: target.id, label: target.fullName },
        details: { by: "admin" },
      },
      tx,
    );
    await auth.setPassword(userId, value);
  });
}

export async function updateOwnName(
  actor: CurrentUser,
  name: string,
  { executor = db }: Deps = {},
): Promise<void> {
  await updateProfile(
    actor,
    actor.id,
    { fullName: parse(fullName, name) },
    executor,
  );
}

export async function changeOwnPassword(
  actor: CurrentUser,
  currentPassword: string,
  newPassword: string,
  { auth, executor = db }: AuthDeps,
): Promise<void> {
  const value = parse(password, newPassword);
  if (!(await auth.verifyPassword(actor.email, currentPassword))) {
    throw new UserInputError("Your current password is wrong.");
  }
  await executor.transaction(async (tx) => {
    await logEvent({ action: "password_change", user: actor }, tx);
    await auth.setPassword(actor.id, value);
  });
}

async function updateProfile(
  actor: CurrentUser,
  userId: string,
  values: Partial<
    Pick<typeof profiles.$inferInsert, "fullName" | "role" | "isActive">
  >,
  executor: Db | Tx,
) {
  const updated = await withUser(
    actor,
    (tx) =>
      tx
        .update(profiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(profiles.id, userId))
        .returning({ id: profiles.id }),
    executor,
  );
  if (updated.length === 0)
    throw new UserInputError("That User doesn't exist.");
}
