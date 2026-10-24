import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbError, dbTest, inSavepoint } from "@/db/test/rollback";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth";
import type { Role } from "@/lib/permissions";
import {
  changeOwnPassword,
  changeRole,
  createUser,
  getUser,
  listUsers,
  resetPassword,
  setActive,
  updateOwnName,
  type AuthAdmin,
} from "@/services/users";

// Stands in for the Supabase Admin API inside the rolled-back transaction.
function fakeAuth(tx: Tx) {
  const passwords = new Map<string, string>();
  const emails = new Map<string, string>();
  const auth: AuthAdmin = {
    async createUser({ email, password }) {
      const id = randomUUID();
      await tx.execute(
        sql`insert into auth.users (id, email) values (${id}, ${email})`,
      );
      passwords.set(id, password);
      emails.set(email, id);
      return { id };
    },
    async deleteUser(id) {
      await tx.execute(sql`delete from auth.users where id = ${id}`);
    },
    async setPassword(id, password) {
      passwords.set(id, password);
    },
    async verifyPassword(email, password) {
      const id = emails.get(email);
      return !!id && passwords.get(id) === password;
    },
  };
  return { auth, passwords, emails };
}

async function seedActor(tx: Tx, role: Role, name = `Test ${role}`) {
  const actor = await seedUser(tx, { fullName: name, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name, email: profile!.email, role } as CurrentUser;
}

function profileOf(tx: Tx, id: string) {
  return tx.query.profiles.findFirst({ where: eq(profiles.id, id) });
}

function latestLog(tx: Tx, entityId: string, kind: "data" | "event") {
  return tx
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.entityId, entityId), eq(activityLog.kind, kind)))
    .orderBy(desc(activityLog.id))
    .limit(1)
    .then((rows) => rows[0]);
}

const newUser = {
  fullName: "Rahim Manager",
  email: "Rahim@Example.com",
  role: "manager" as const,
  password: "temporary-pass-1",
};

describe("createUser", () => {
  dbTest("lets an Admin create a User, logged as that Admin", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { auth, passwords } = fakeAuth(tx);

    const id = await createUser(admin, newUser, { auth, executor: tx });

    expect(await profileOf(tx, id)).toMatchObject({
      fullName: "Rahim Manager",
      email: "rahim@example.com",
      role: "manager",
      isActive: true,
    });
    expect(passwords.get(id)).toBe("temporary-pass-1");
    expect(await latestLog(tx, id, "data")).toMatchObject({
      action: "insert",
      userId: admin.id,
      entityLabel: "Rahim Manager",
    });
  });

  for (const role of ["manager", "staff"] as const) {
    dbTest(`refuses a ${role}`, async (tx) => {
      const actor = await seedActor(tx, role);
      const { auth, emails } = fakeAuth(tx);

      await expect(
        createUser(actor, newUser, { auth, executor: tx }),
      ).rejects.toBeInstanceOf(NotAllowedError);
      expect(emails.size).toBe(0);
    });
  }

  dbTest("refuses an email that already has a User", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { auth } = fakeAuth(tx);
    await createUser(admin, newUser, { auth, executor: tx });

    await expect(
      createUser(
        admin,
        { ...newUser, email: "rahim@example.com" },
        { auth, executor: tx },
      ),
    ).rejects.toThrow(
      new UserInputError("A User with that email already exists."),
    );
  });

  dbTest("rejects a short temporary password", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { auth } = fakeAuth(tx);

    await expect(
      createUser(
        admin,
        { ...newUser, password: "short" },
        { auth, executor: tx },
      ),
    ).rejects.toBeInstanceOf(UserInputError);
  });
});

describe("createUser when the profile can't be written", () => {
  dbTest(
    "removes the auth account and keeps the original error",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const { auth } = fakeAuth(tx);
      const deleted: string[] = [];
      // An id with no auth.users row, so the profile insert fails its FK.
      const broken: AuthAdmin = {
        ...auth,
        createUser: async () => ({ id: randomUUID() }),
        deleteUser: async (id) => {
          deleted.push(id);
          throw new Error("Auth API down");
        },
      };

      await expect(
        createUser(admin, newUser, { auth: broken, executor: tx }),
      ).rejects.toMatchObject(dbError(/foreign key/));
      expect(deleted).toHaveLength(1);
    },
  );
});

describe("changeRole and setActive", () => {
  dbTest("let an Admin change a role and deactivate", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");

    await changeRole(admin, staff.id, "manager", { executor: tx });
    expect((await latestLog(tx, staff.id, "data"))?.changes).toEqual({
      role: { from: "staff", to: "manager" },
    });

    await setActive(admin, staff.id, false, { executor: tx });
    expect((await profileOf(tx, staff.id))?.isActive).toBe(false);
    await setActive(admin, staff.id, true, { executor: tx });
    expect((await profileOf(tx, staff.id))?.isActive).toBe(true);
  });

  dbTest("stop an Admin locking themselves out", async (tx) => {
    const admin = await seedActor(tx, "admin");

    await expect(
      changeRole(admin, admin.id, "staff", { executor: tx }),
    ).rejects.toThrow(new UserInputError("You can't change your own role."));
    await expect(
      setActive(admin, admin.id, false, { executor: tx }),
    ).rejects.toThrow(new UserInputError("You can't deactivate yourself."));
  });

  dbTest("are refused to a Manager", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const staff = await seedActor(tx, "staff");

    await expect(
      changeRole(manager, staff.id, "admin", { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      setActive(manager, staff.id, false, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe("resetPassword", () => {
  dbTest("lets an Admin set a User's password, logged", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { auth, passwords } = fakeAuth(tx);
    const id = await createUser(admin, newUser, { auth, executor: tx });

    await resetPassword(admin, id, "another-pass-2", { auth, executor: tx });

    expect(passwords.get(id)).toBe("another-pass-2");
    expect(await latestLog(tx, id, "event")).toMatchObject({
      action: "password_reset",
      userId: admin.id,
      entityLabel: "Rahim Manager",
    });
  });

  dbTest("changes nothing when the password can't be set", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const { auth } = fakeAuth(tx);
    const failing: AuthAdmin = {
      ...auth,
      setPassword: async () => {
        throw new Error("Auth API down");
      },
    };

    await expect(
      inSavepoint(tx, (sp) =>
        resetPassword(admin, staff.id, "another-pass-2", {
          auth: failing,
          executor: sp,
        }),
      ),
    ).rejects.toThrow("Auth API down");
    expect(await latestLog(tx, staff.id, "event")).toBeUndefined();
  });

  dbTest("is refused to a Manager", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const staff = await seedActor(tx, "staff");
    const { auth } = fakeAuth(tx);

    await expect(
      resetPassword(manager, staff.id, "another-pass-2", {
        auth,
        executor: tx,
      }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe("listUsers", () => {
  dbTest("is for Admins only", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");

    await expect(listUsers(staff, {}, { executor: tx })).rejects.toBeInstanceOf(
      NotAllowedError,
    );
    const { users } = await listUsers(
      admin,
      { query: staff.email },
      { executor: tx },
    );
    expect(users.map((u) => u.id)).toEqual([staff.id]);
  });

  dbTest("searches name or email, case-insensitively", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const karim = await seedActor(tx, "staff", "Karim Zzqx Uddin");

    const byName = await listUsers(admin, { query: "zzqx" }, { executor: tx });
    expect(byName.users.map((u) => u.id)).toEqual([karim.id]);
    expect(byName.total).toBe(1);
  });

  dbTest("pages 25 at a time", async (tx) => {
    const admin = await seedActor(tx, "admin");
    for (let i = 0; i < 26; i++) {
      await seedActor(tx, "staff", `Pager ${String(i).padStart(2, "0")} Qqzz`);
    }

    const first = await listUsers(admin, { query: "qqzz" }, { executor: tx });
    const second = await listUsers(
      admin,
      { query: "qqzz", page: 2 },
      { executor: tx },
    );
    expect(first.total).toBe(26);
    expect(first.users).toHaveLength(25);
    expect(second.users.map((u) => u.fullName)).toEqual(["Pager 25 Qqzz"]);
  });
});

describe("getUser", () => {
  dbTest("returns a User to an Admin only", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");

    expect(await getUser(admin, staff.id, { executor: tx })).toMatchObject({
      id: staff.id,
      role: "staff",
    });
    expect(
      await getUser(admin, "00000000-0000-0000-0000-000000000000", {
        executor: tx,
      }),
    ).toBeUndefined();
    await expect(
      getUser(staff, admin.id, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe("own account", () => {
  dbTest("any User can rename themselves", async (tx) => {
    const staff = await seedActor(tx, "staff");

    await updateOwnName(staff, "Karim Uddin", { executor: tx });

    expect((await profileOf(tx, staff.id))?.fullName).toBe("Karim Uddin");
    expect(await latestLog(tx, staff.id, "data")).toMatchObject({
      action: "update",
      userId: staff.id,
      changes: { full_name: { from: "Test staff", to: "Karim Uddin" } },
    });
  });

  dbTest(
    "changing password needs the current one and is logged",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const { auth, passwords } = fakeAuth(tx);
      const id = await createUser(admin, newUser, { auth, executor: tx });
      const self: CurrentUser = {
        id,
        name: newUser.fullName,
        email: "rahim@example.com",
        role: "manager",
      };

      await expect(
        changeOwnPassword(self, "wrong", "brand-new-pass", {
          auth,
          executor: tx,
        }),
      ).rejects.toThrow(new UserInputError("Your current password is wrong."));

      await changeOwnPassword(self, "temporary-pass-1", "brand-new-pass", {
        auth,
        executor: tx,
      });
      expect(passwords.get(id)).toBe("brand-new-pass");
      expect(await latestLog(tx, id, "event")).toMatchObject({
        action: "password_change",
        userId: id,
      });
    },
  );
});
