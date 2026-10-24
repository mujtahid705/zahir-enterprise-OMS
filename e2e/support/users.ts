import { requireEnv, type SeedUser } from "../../scripts/seed-users.mts";

// Seeded test Users, marked by @test.ze (ADR 0002). Specs that end a session
// or change a password get one User per Playwright project, so desktop and
// phone runs don't collide.
type TestUser = Omit<SeedUser, "password">;

const PROJECTS = ["desktop", "phone"] as const;

// Signed-in session of the test Admin, written by global setup.
export const ADMIN_STATE = "e2e/.auth/admin.json";

export const E2E_USERS = {
  admin: { email: "admin@test.ze", fullName: "Test Admin", role: "admin" },
  deactivated: {
    email: "deactivated@test.ze",
    fullName: "Test Deactivated",
    role: "staff",
    isActive: false,
  },
} satisfies Record<string, TestUser>;

export function projectUser(
  kind: "logout" | "reset" | "account",
  project: string,
): TestUser {
  return {
    email: `${kind}-${project}@test.ze`,
    fullName: `Test ${kind} ${project}`,
    role: "staff",
  };
}

export function e2ePassword(): string {
  return requireEnv("E2E_PASSWORD");
}

export function seedUserList(): SeedUser[] {
  const users: TestUser[] = [
    ...Object.values(E2E_USERS),
    ...PROJECTS.flatMap((p) => [
      projectUser("logout", p),
      projectUser("reset", p),
      projectUser("account", p),
    ]),
  ];
  return users.map((user) => ({ ...user, password: e2ePassword() }));
}
