import { desc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { activityLog } from "@/db/schema";
import { createUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import { logEvent } from "@/lib/activity";

describe("logEvent", () => {
  dbTest("records an event attributed to the user", async (tx) => {
    const staff = await createUser(tx, { fullName: "Karim Staff" });

    await logEvent({ action: "login", user: staff }, tx);

    const [row] = await tx
      .select()
      .from(activityLog)
      .where(eq(activityLog.userId, staff.id))
      .orderBy(desc(activityLog.id))
      .limit(1);
    expect(row).toMatchObject({
      kind: "event",
      action: "login",
      userId: staff.id,
      userName: "Karim Staff",
      entityType: "profiles",
      entityId: staff.id,
      entityLabel: "Karim Staff",
      details: null,
    });
  });

  dbTest("records a failed login with the email tried", async (tx) => {
    await logEvent(
      { action: "login_failed", user: null, details: { email: "who@x.ze" } },
      tx,
    );

    const [row] = await tx
      .select()
      .from(activityLog)
      .orderBy(desc(activityLog.id))
      .limit(1);
    expect(row).toMatchObject({
      kind: "event",
      action: "login_failed",
      userId: null,
      userName: null,
      details: { email: "who@x.ze" },
    });
  });
});
