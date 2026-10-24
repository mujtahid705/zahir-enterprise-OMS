import { asc, eq, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, companySettings, profiles } from "@/db/schema";
import { asSystem, createUser } from "@/db/test/fixtures";
import { dbError, dbTest, inSavepoint } from "@/db/test/rollback";
import { withUser } from "@/db/with-user";

function logFor(tx: Tx, entityId: string) {
  return tx
    .select()
    .from(activityLog)
    .where(eq(activityLog.entityId, entityId))
    .orderBy(asc(activityLog.id));
}

describe("writes inside withUser", () => {
  dbTest("log an update with the field diff, user and label", async (tx) => {
    const admin = await createUser(tx, {
      fullName: "Rahim Admin",
      role: "admin",
    });
    const staff = await createUser(tx);

    const [updated] = await withUser(
      admin,
      (w) =>
        w
          .update(profiles)
          .set({ fullName: "Karim Staff" })
          .where(eq(profiles.id, staff.id))
          .returning(),
      tx,
    );

    const [, update] = await logFor(tx, updated.id);
    expect(update).toMatchObject({
      kind: "data",
      action: "update",
      userId: admin.id,
      userName: "Rahim Admin",
      entityType: "profiles",
      entityLabel: "Karim Staff",
      orderId: null,
      changes: { full_name: { from: "Test User", to: "Karim Staff" } },
    });
  });

  dbTest("record an insert as the full new row", async (tx) => {
    const admin = await createUser(tx, { fullName: "Rahim Admin" });
    // Single-row table: clear any real row (rolled back with the test).
    await asSystem(tx, () => tx.delete(companySettings));
    const [settings] = await withUser(
      admin,
      (w) =>
        w
          .insert(companySettings)
          .values({ name: "Zahir Enterprise", phone: "01700000000" })
          .returning(),
      tx,
    );

    const [insert] = await logFor(tx, settings.id);
    expect(insert).toMatchObject({
      action: "insert",
      userId: admin.id,
      entityType: "company_settings",
      entityLabel: "Company settings",
    });
    expect(insert.changes).toMatchObject({
      name: "Zahir Enterprise",
      phone: "01700000000",
    });
  });

  dbTest("ignore updated_at in the diff", async (tx) => {
    const admin = await createUser(tx);
    const staff = await createUser(tx);

    await withUser(
      admin,
      (w) =>
        w
          .update(profiles)
          .set({ role: "manager", updatedAt: new Date() })
          .where(eq(profiles.id, staff.id)),
      tx,
    );

    const [, update] = await logFor(tx, staff.id);
    expect(update.changes).toEqual({
      role: { from: "staff", to: "manager" },
    });
  });

  dbTest("skip an update that only touches updated_at", async (tx) => {
    const admin = await createUser(tx);
    const staff = await createUser(tx);

    await withUser(
      admin,
      (w) =>
        w
          .update(profiles)
          .set({ updatedAt: new Date() })
          .where(eq(profiles.id, staff.id)),
      tx,
    );

    expect((await logFor(tx, staff.id)).map((r) => r.action)).toEqual([
      "insert",
    ]);
  });

  dbTest("group every row from one save under one tx_id", async (tx) => {
    const admin = await createUser(tx);
    const a = await createUser(tx);
    const b = await createUser(tx);

    await withUser(
      admin,
      async (w) => {
        await w
          .update(profiles)
          .set({ isActive: false })
          .where(eq(profiles.id, a.id));
        await w
          .update(profiles)
          .set({ isActive: false })
          .where(eq(profiles.id, b.id));
      },
      tx,
    );

    const [, updateA] = await logFor(tx, a.id);
    const [, updateB] = await logFor(tx, b.id);
    const [{ txid }] = await tx.execute<{ txid: string }>(
      sql`select txid_current()::text as txid`,
    );
    expect(String(updateA.txId)).toBe(txid);
    expect(updateB.txId).toBe(updateA.txId);
  });
});

describe("writes outside withUser", () => {
  dbTest("fail when no user is set", async (tx) => {
    const staff = await createUser(tx);

    await expect(
      inSavepoint(tx, (sp) =>
        sp
          .update(profiles)
          .set({ fullName: "Unattributed" })
          .where(eq(profiles.id, staff.id)),
      ),
    ).rejects.toMatchObject(dbError(/without a user/));
  });

  dbTest("fail after an earlier withUser has returned", async (tx) => {
    const admin = await createUser(tx);
    const staff = await createUser(tx);
    await withUser(
      admin,
      (w) =>
        w
          .update(profiles)
          .set({ role: "manager" })
          .where(eq(profiles.id, staff.id)),
      tx,
    );

    await expect(
      inSavepoint(tx, (sp) =>
        sp
          .update(profiles)
          .set({ role: "admin" })
          .where(eq(profiles.id, staff.id)),
      ),
    ).rejects.toMatchObject(dbError(/without a user/));
  });

  dbTest("fail when truncating a logged table", async (tx) => {
    const admin = await createUser(tx);

    await expect(
      withUser(admin, (w) => w.execute(sql`truncate company_settings`), tx),
    ).rejects.toMatchObject(dbError(/cannot be logged/));
  });

  dbTest("succeed as the system actor, unattributed", async (tx) => {
    const staff = await createUser(tx, { fullName: "Seeded" });

    const [insert] = await logFor(tx, staff.id);
    expect(insert).toMatchObject({
      action: "insert",
      userId: null,
      userName: "System",
      entityLabel: "Seeded",
    });
  });
});

describe("the activity log", () => {
  dbTest("cannot be updated, deleted or truncated", async (tx) => {
    const staff = await createUser(tx);
    const [row] = await logFor(tx, staff.id);

    await expect(
      inSavepoint(tx, (sp) =>
        sp
          .update(activityLog)
          .set({ userName: "Someone else" })
          .where(eq(activityLog.id, row.id)),
      ),
    ).rejects.toThrow();
    await expect(
      inSavepoint(tx, (sp) =>
        sp.delete(activityLog).where(eq(activityLog.id, row.id)),
      ),
    ).rejects.toThrow();
    await expect(
      inSavepoint(tx, (sp) => sp.execute(sql`truncate activity_log`)),
    ).rejects.toThrow();

    const [after] = await logFor(tx, staff.id);
    expect(after.userName).toBe(row.userName);
  });

  dbTest("rejects changes even for its owner", async (tx) => {
    const staff = await createUser(tx);
    const [row] = await logFor(tx, staff.id);

    // Grants can be re-added by the table owner; the trigger still holds.
    await tx.execute(
      sql`grant update, delete, truncate on activity_log to current_user`,
    );

    for (const statement of [
      sql`update activity_log set user_name = 'x' where id = ${row.id}`,
      sql`delete from activity_log where id = ${row.id}`,
      sql`truncate activity_log`,
    ]) {
      await expect(
        inSavepoint(tx, (sp) => sp.execute(statement)),
      ).rejects.toMatchObject(dbError(/append-only/));
    }
  });
});

describe("row level security", () => {
  dbTest("is enabled on every public table with no policies", async (tx) => {
    const tables = await tx.execute<{ name: string; rls: boolean }>(sql`
      select c.relname as name, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(["profiles", "company_settings", "activity_log"]),
    );
    expect(tables.filter((t) => !t.rls)).toEqual([]);

    const policies = await tx.execute(
      sql`select policyname from pg_policies where schemaname = 'public'`,
    );
    expect([...policies]).toEqual([]);
  });
});
