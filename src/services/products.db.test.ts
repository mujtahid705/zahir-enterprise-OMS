import { and, desc, eq, sql } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import { customers, suppliers } from "@/services/parties";
import { products } from "@/services/products";

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

function latestLog(tx: Tx, entityId: string) {
  return tx
    .select()
    .from(activityLog)
    .where(
      and(eq(activityLog.entityId, entityId), eq(activityLog.kind, "data")),
    )
    .orderBy(desc(activityLog.id))
    .limit(1)
    .then((rows) => rows[0]);
}

// SPEC §15 Phase 2 done-when: Highway Sweets, Suzinas and a bread poly packet
// for Highway Sweets made by Suzinas.
async function seedParties(tx: Tx, actor: CurrentUser) {
  const executor = { executor: tx };
  const highwaySweets = await customers.create(
    actor,
    {
      name: "Highway Sweets",
      phone: "01711000000",
      address: "12 Station Road, Dhaka",
    },
    executor,
  );
  const luckyBakery = await customers.create(
    actor,
    { name: "Lucky Bakery", phone: "01711000001", address: "Mirpur 10" },
    executor,
  );
  const suzinas = await suppliers.create(
    actor,
    {
      name: "Suzinas",
      phone: "01811000000",
      whatsapp: "01811000000",
      address: "Plot 4, Tongi BSCIC",
    },
    executor,
  );
  const rahim = await suppliers.create(
    actor,
    {
      name: "Rahim Plastics",
      phone: "01811000001",
      whatsapp: "01811000001",
      address: "Narayanganj",
    },
    executor,
  );
  return { highwaySweets, luckyBakery, suzinas, rahim };
}

function breadPacket(customerId: string, supplierId: string) {
  return {
    customerId,
    supplierId,
    name: "Bread poly packet 10×14",
    size: "10×14 in",
    thickness: "40 micron",
    colour: "Clear",
    printDetails: "2 colour, logo front",
    sellPrice: "2.5",
    buyPrice: "2",
  };
}

describe("create", () => {
  dbTest(
    "gives a Product the next P- code with its prices, logged",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const { highwaySweets, suzinas } = await seedParties(tx, manager);

      const { id, code } = await products.create(
        manager,
        breadPacket(highwaySweets.id, suzinas.id),
        { executor: tx },
      );

      expect(code).toMatch(/^P-\d{4,}$/);
      expect(await products.get(manager, id, { executor: tx })).toMatchObject({
        code,
        name: "Bread poly packet 10×14",
        description: null,
        sellPrice: "2.50",
        buyPrice: "2.00",
        isActive: true,
        customer: { id: highwaySweets.id, name: "Highway Sweets" },
        supplier: { id: suzinas.id, name: "Suzinas" },
        margin: { perPiece: "0.50", percent: 20 },
        createdBy: manager.id,
      });
      expect(await latestLog(tx, id)).toMatchObject({
        action: "insert",
        userId: manager.id,
        entityLabel: `${code} Bread poly packet 10×14`,
      });
    },
  );

  dbTest("is refused to Staff", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);

    await expect(
      products.create(staff, breadPacket(highwaySweets.id, suzinas.id), {
        executor: tx,
      }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  dbTest("requires prices above 0 with at most 2 decimals", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    const input = breadPacket(highwaySweets.id, suzinas.id);

    await expect(
      products.create(admin, { ...input, sellPrice: "0" }, { executor: tx }),
    ).rejects.toThrow(new UserInputError("Price must be more than 0."));
    await expect(
      products.create(admin, { ...input, buyPrice: "1.555" }, { executor: tx }),
    ).rejects.toThrow(new UserInputError("Use at most 2 decimal places."));
  });

  dbTest("refuses a deactivated Customer or Supplier", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas, rahim } = await seedParties(tx, admin);
    await suppliers.setActive(admin, rahim.id, false, { executor: tx });

    await expect(
      products.create(admin, breadPacket(highwaySweets.id, rahim.id), {
        executor: tx,
      }),
    ).rejects.toThrow(new UserInputError("Pick an active Supplier."));

    await customers.setActive(admin, highwaySweets.id, false, {
      executor: tx,
    });
    await expect(
      products.create(admin, breadPacket(highwaySweets.id, suzinas.id), {
        executor: tx,
      }),
    ).rejects.toThrow(new UserInputError("Pick an active Customer."));
  });
});

describe("get", () => {
  dbTest("never hands Staff the margin, but shows both prices", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    const { id } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    expect(await products.get(staff, id, { executor: tx })).toMatchObject({
      sellPrice: "2.50",
      buyPrice: "2.00",
      margin: null,
    });
  });
});

describe("update", () => {
  dbTest("changes Supplier and prices, logged field by field", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const { highwaySweets, suzinas, rahim } = await seedParties(tx, manager);
    const input = breadPacket(highwaySweets.id, suzinas.id);
    const { id } = await products.create(manager, input, { executor: tx });

    await products.update(
      manager,
      id,
      { ...input, supplierId: rahim.id, sellPrice: "3", buyPrice: "2.10" },
      { executor: tx },
    );

    expect(await products.get(manager, id, { executor: tx })).toMatchObject({
      customer: { id: highwaySweets.id },
      supplier: { id: rahim.id, name: "Rahim Plastics" },
      sellPrice: "3.00",
      buyPrice: "2.10",
      margin: { perPiece: "0.90", percent: 30 },
      updatedBy: manager.id,
    });
    expect((await latestLog(tx, id))?.changes).toEqual({
      supplier_id: { from: suzinas.id, to: rahim.id },
      sell_price: { from: 2.5, to: 3 },
      buy_price: { from: 2, to: 2.1 },
    });
  });

  dbTest("keeps the Customer the Product was made for", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, luckyBakery, suzinas } = await seedParties(
      tx,
      admin,
    );
    const { id } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    await products.update(
      admin,
      id,
      { ...breadPacket(luckyBakery.id, suzinas.id), name: "Bread packet" },
      { executor: tx },
    );

    expect(await products.get(admin, id, { executor: tx })).toMatchObject({
      name: "Bread packet",
      customer: { id: highwaySweets.id },
    });
  });

  dbTest(
    "refuses a deactivated new Supplier, keeps a deactivated current one",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const { highwaySweets, suzinas, rahim } = await seedParties(tx, admin);
      const input = breadPacket(highwaySweets.id, suzinas.id);
      const { id } = await products.create(admin, input, { executor: tx });
      await suppliers.setActive(admin, rahim.id, false, { executor: tx });
      await suppliers.setActive(admin, suzinas.id, false, { executor: tx });

      await expect(
        products.update(
          admin,
          id,
          { ...input, supplierId: rahim.id },
          { executor: tx },
        ),
      ).rejects.toThrow(new UserInputError("Pick an active Supplier."));
      await products.update(
        admin,
        id,
        { ...input, sellPrice: "2.75" },
        { executor: tx },
      );
      expect((await products.get(admin, id, { executor: tx }))?.sellPrice).toBe(
        "2.75",
      );
    },
  );

  dbTest("deactivates and reactivates", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const { highwaySweets, suzinas } = await seedParties(tx, manager);
    const { id } = await products.create(
      manager,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    await products.setActive(manager, id, false, { executor: tx });
    expect((await products.get(manager, id, { executor: tx }))?.isActive).toBe(
      false,
    );
    await products.setActive(manager, id, true, { executor: tx });
    expect((await products.get(manager, id, { executor: tx }))?.isActive).toBe(
      true,
    );
  });

  dbTest("is refused to Staff", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    const input = breadPacket(highwaySweets.id, suzinas.id);
    const { id } = await products.create(admin, input, { executor: tx });

    await expect(
      products.update(staff, id, input, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
    await expect(
      products.setActive(staff, id, false, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  dbTest("reports a Product that doesn't exist", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);

    await expect(
      products.update(
        admin,
        crypto.randomUUID(),
        breadPacket(highwaySweets.id, suzinas.id),
        { executor: tx },
      ),
    ).rejects.toThrow(new UserInputError("That Product doesn't exist."));
  });
});

describe("duplicate", () => {
  dbTest(
    "copies specs and Supplier to another Customer with new prices",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const { highwaySweets, luckyBakery, suzinas } = await seedParties(
        tx,
        manager,
      );
      const original = await products.create(
        manager,
        breadPacket(highwaySweets.id, suzinas.id),
        { executor: tx },
      );

      const copy = await products.duplicate(
        manager,
        original.id,
        { customerId: luckyBakery.id, sellPrice: "2.80", buyPrice: "2.00" },
        { executor: tx },
      );

      expect(copy.code).not.toBe(original.code);
      expect(
        await products.get(manager, copy.id, { executor: tx }),
      ).toMatchObject({
        name: "Bread poly packet 10×14",
        size: "10×14 in",
        thickness: "40 micron",
        colour: "Clear",
        printDetails: "2 colour, logo front",
        customer: { id: luckyBakery.id },
        supplier: { id: suzinas.id },
        sellPrice: "2.80",
        buyPrice: "2.00",
        isActive: true,
      });
      expect(
        (await products.get(manager, original.id, { executor: tx }))?.customer
          .id,
      ).toBe(highwaySweets.id);
    },
  );

  dbTest("is refused to Staff", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const { highwaySweets, luckyBakery, suzinas } = await seedParties(
      tx,
      admin,
    );
    const { id } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    await expect(
      products.duplicate(
        staff,
        id,
        { customerId: luckyBakery.id, sellPrice: "3", buyPrice: "2" },
        { executor: tx },
      ),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe("duplicate rules", () => {
  dbTest("refuses the Product's own Customer", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    const { id } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    await expect(
      products.duplicate(
        admin,
        id,
        { customerId: highwaySweets.id, sellPrice: "3", buyPrice: "2" },
        { executor: tx },
      ),
    ).rejects.toThrow(
      new UserInputError("Pick a different Customer to duplicate for."),
    );
  });

  dbTest("explains a deactivated Supplier", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, luckyBakery, suzinas } = await seedParties(
      tx,
      admin,
    );
    const { id } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );
    await suppliers.setActive(admin, suzinas.id, false, { executor: tx });

    await expect(
      products.duplicate(
        admin,
        id,
        { customerId: luckyBakery.id, sellPrice: "3", buyPrice: "2" },
        { executor: tx },
      ),
    ).rejects.toThrow(
      new UserInputError(
        "Suzinas is deactivated. Change this Product's Supplier before duplicating it.",
      ),
    );
  });
});

describe("remove", () => {
  dbTest("lets an Admin delete an unused Product, logged", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    const { id } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    await products.remove(admin, id, { executor: tx });

    expect(await products.get(admin, id, { executor: tx })).toBeUndefined();
    expect(await latestLog(tx, id)).toMatchObject({ action: "delete" });
  });

  dbTest("is refused to a Manager", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const { highwaySweets, suzinas } = await seedParties(tx, manager);
    const { id } = await products.create(
      manager,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );

    await expect(
      products.remove(manager, id, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });

  dbTest("refuses a Product used in an Order", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    const { id, code } = await products.create(
      admin,
      breadPacket(highwaySweets.id, suzinas.id),
      { executor: tx },
    );
    // Stands in for order_items.product_id (SPEC §14), rolled back.
    await tx.execute(sql`
      create table test_order_items (product_id uuid not null references products)`);
    await tx.execute(sql`insert into test_order_items values (${id})`);

    await expect(products.remove(admin, id, { executor: tx })).rejects.toThrow(
      new UserInputError(
        `${code} Bread poly packet 10×14 is in use, so it can't be deleted. Deactivate it instead.`,
      ),
    );
  });

  dbTest("keeps a Customer or Supplier with Products", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const { highwaySweets, suzinas } = await seedParties(tx, admin);
    await products.create(admin, breadPacket(highwaySweets.id, suzinas.id), {
      executor: tx,
    });

    await expect(
      customers.remove(admin, highwaySweets.id, { executor: tx }),
    ).rejects.toBeInstanceOf(UserInputError);
    await expect(
      suppliers.remove(admin, suzinas.id, { executor: tx }),
    ).rejects.toBeInstanceOf(UserInputError);
  });
});

describe("list", () => {
  async function seedCatalogue(tx: Tx, actor: CurrentUser) {
    const parties = await seedParties(tx, actor);
    const { highwaySweets, luckyBakery, suzinas, rahim } = parties;
    const create = (input: ReturnType<typeof breadPacket>) =>
      products.create(actor, input, { executor: tx });
    const bread = await create(breadPacket(highwaySweets.id, suzinas.id));
    const box = await create({
      ...breadPacket(highwaySweets.id, rahim.id),
      name: "Sweet box 1 kg",
    });
    const luckyBread = await create(breadPacket(luckyBakery.id, suzinas.id));
    return { ...parties, bread, box, luckyBread };
  }

  dbTest("filters by Customer and by Supplier", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const c = await seedCatalogue(tx, manager);
    const ids = async (filter: { customerId?: string; supplierId?: string }) =>
      (await products.list(manager, filter, { executor: tx })).rows
        .map((row) => row.id)
        .sort();

    expect(await ids({ customerId: c.highwaySweets.id })).toEqual(
      [c.bread.id, c.box.id].sort(),
    );
    expect(await ids({ supplierId: c.suzinas.id })).toEqual(
      [c.bread.id, c.luckyBread.id].sort(),
    );
    expect(
      await ids({ customerId: c.highwaySweets.id, supplierId: c.suzinas.id }),
    ).toEqual([c.bread.id]);
  });

  dbTest("searches code or name, active unless asked", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const c = await seedCatalogue(tx, manager);
    await products.setActive(manager, c.box.id, false, { executor: tx });
    const list = (query: string, status?: "all") =>
      products.list(
        manager,
        { query, status, customerId: c.highwaySweets.id },
        { executor: tx },
      );

    expect((await list("sweet box")).total).toBe(0);
    expect((await list("sweet box", "all")).rows).toMatchObject([
      { id: c.box.id, isActive: false },
    ]);
    expect((await list(c.bread.code)).rows).toMatchObject([{ id: c.bread.id }]);
  });

  dbTest("leaves margin out for Staff", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx, admin);

    const { rows } = await products.list(
      staff,
      { customerId: c.highwaySweets.id },
      { executor: tx },
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.margin === null)).toBe(true);
    const asAdmin = await products.list(
      admin,
      { customerId: c.highwaySweets.id },
      { executor: tx },
    );
    expect(asAdmin.rows.every((row) => row.margin !== null)).toBe(true);
  });
});
