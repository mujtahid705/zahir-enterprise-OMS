import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import { logEvent } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { NotAllowedError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import { activity } from "@/services/activity";
import { orders } from "@/services/orders";
import { customers, suppliers } from "@/services/parties";
import { products } from "@/services/products";

// A DB test runs in one rolled-back transaction (ADR 0002), so everything it
// writes is one save: one entry. Grouping several saves is covered by the
// unit tests of groupEntries.

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

// A Manager enters Highway Sweets, Suzinas and a bread poly packet, then
// orders it; the Admin reads the log.
async function seed(tx: Tx) {
  const admin = await seedActor(tx, "admin");
  const manager = await seedActor(tx, "manager");
  const executor = { executor: tx };
  const highwaySweets = await customers.create(
    manager,
    { name: "Highway Sweets", phone: "01711000000", address: "Dhaka" },
    executor,
  );
  const suzinas = await suppliers.create(
    manager,
    {
      name: "Suzinas",
      phone: "01811000000",
      whatsapp: "01811000000",
      address: "Tongi",
    },
    executor,
  );
  const bread = await products.create(
    manager,
    {
      customerId: highwaySweets.id,
      supplierId: suzinas.id,
      name: "Bread poly packet",
      sellPrice: "2.50",
      buyPrice: "2.00",
    },
    executor,
  );
  const order = await orders.create(
    manager,
    {
      customerId: highwaySweets.id,
      orderDate: todayInDhaka(),
      items: [{ productId: bread.id, quantity: 5000 }],
    },
    executor,
  );
  return { admin, manager, highwaySweets, bread, order };
}

describe("list", () => {
  dbTest(
    "shows a User's save as one entry under today, with every row",
    async (tx) => {
      const s = await seed(tx);

      const { days, total } = await activity.list(
        s.admin,
        { userId: s.manager.id },
        { executor: tx },
      );

      expect(total).toBe(1);
      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({ day: todayInDhaka(), count: 1 });
      const [entry] = days[0]!.entries;
      expect(entry!.details.map((detail) => detail.title)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^Created · Customer C-\d+ Highway Sweets$/),
          expect.stringMatching(/^Created · Product P-\d+ Bread poly packet$/),
          `Created · Order ${s.order.orderNo}`,
          "Created · Item Bread poly packet",
        ]),
      );
    },
  );

  dbTest("finds an Order's item rows by the Order number", async (tx) => {
    const s = await seed(tx);

    const { total } = await activity.list(
      s.admin,
      { query: s.order.orderNo, recordType: "orders", actionType: "created" },
      { executor: tx },
    );

    expect(total).toBeGreaterThanOrEqual(1);
  });

  dbTest("leaves out saves outside the filters", async (tx) => {
    const s = await seed(tx);
    const mine = { userId: s.manager.id };
    const count = async (filters: Parameters<typeof activity.list>[1]) =>
      (await activity.list(s.admin, { ...mine, ...filters }, { executor: tx }))
        .total;

    expect(await count({ to: "2020-01-01" })).toBe(0);
    expect(await count({ from: todayInDhaka(), to: todayInDhaka() })).toBe(1);
    expect(await count({ actionType: "deleted" })).toBe(0);
    expect(await count({ recordType: "settings" })).toBe(0);
    expect(await count({ query: "no such record" })).toBe(0);
  });

  dbTest("finds a failed sign-in by the email tried", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const email = `nobody-${Date.now()}@x.ze`;
    await logEvent(
      { action: "login_failed", user: null, details: { email } },
      tx,
    );

    const { total } = await activity.list(
      admin,
      { query: email, actionType: "auth" },
      { executor: tx },
    );

    expect(total).toBe(1);
  });

  dbTest("scopes a History tab to its record", async (tx) => {
    const s = await seed(tx);
    await logEvent({ action: "login", user: s.manager }, tx);

    const product = await activity.list(
      s.admin,
      {},
      {
        executor: tx,
        scope: { entityType: "products", entityId: s.bread.id },
      },
    );
    const order = await activity.list(
      s.admin,
      { actionType: "auth" },
      { executor: tx, scope: { orderId: s.order.id } },
    );

    expect(product.total).toBe(1);
    expect(order.total).toBe(0);
  });

  dbTest("is for Admins only (SPEC §11)", async (tx) => {
    const s = await seed(tx);

    await expect(
      activity.list(s.manager, {}, { executor: tx }),
    ).rejects.toThrow(NotAllowedError);
    await expect(activity.all(s.manager, {}, { executor: tx })).rejects.toThrow(
      NotAllowedError,
    );
  });
});

describe("all", () => {
  dbTest("exports every matching entry, unpaged", async (tx) => {
    const s = await seed(tx);

    const entries = await activity.all(
      s.admin,
      { userId: s.manager.id },
      { executor: tx },
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]!.userName).toBeTruthy();
  });
});
