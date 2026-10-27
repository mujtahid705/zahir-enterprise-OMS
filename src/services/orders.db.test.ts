import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest, inRollback } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import { todayInDhaka } from "@/lib/dates";
import type { Role } from "@/lib/permissions";
import { orders } from "@/services/orders";
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

// SPEC §5.4: Highway Sweets buys bread packets and sweet boxes made by
// Suzinas, and carry bags made by Rahim Plastics. Entered by an Admin.
async function seedCatalogue(tx: Tx) {
  const actor = await seedActor(tx, "admin");
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
  const product = (
    name: string,
    supplierId: string,
    prices: { sellPrice: string; buyPrice: string },
    specs: { size?: string; thickness?: string } = {},
  ) =>
    products.create(
      actor,
      { customerId: highwaySweets.id, supplierId, name, ...specs, ...prices },
      executor,
    );
  const bread = await product(
    "Bread poly packet",
    suzinas.id,
    { sellPrice: "2.50", buyPrice: "2.00" },
    { size: "10×14 in", thickness: "40 micron" },
  );
  const carryBag = await product("Carry bag large", rahim.id, {
    sellPrice: "4.00",
    buyPrice: "3.00",
  });
  const sweetBox = await product("Sweet box 1 kg", suzinas.id, {
    sellPrice: "8.00",
    buyPrice: "6.00",
  });
  return { highwaySweets, suzinas, rahim, bread, carryBag, sweetBox };
}

describe("create", () => {
  dbTest(
    "numbers the Order, copies prices onto its Items and makes one Work Order per Supplier",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const c = await seedCatalogue(tx);
      const year = Number(todayInDhaka().slice(0, 4));

      const { id, orderNo } = await orders.create(
        manager,
        {
          customerId: c.highwaySweets.id,
          orderDate: "2026-10-20",
          customerRef: "PO-77",
          items: [
            { productId: c.bread.id, quantity: 5000 },
            { productId: c.carryBag.id, quantity: 2000 },
            { productId: c.sweetBox.id, quantity: 1000 },
          ],
        },
        { executor: tx },
      );

      expect(orderNo).toMatch(new RegExp(`^ORD-${year}-\\d{4,}$`));
      const number = orderNo.slice("ORD-".length);
      const order = await orders.get(manager, id, { executor: tx });
      expect(order).toMatchObject({
        orderNo,
        challanNo: `CH-${number}`,
        invoiceNo: `INV-${number}`,
        status: "created",
        customerId: c.highwaySweets.id,
        customerName: "Highway Sweets",
        customerPhone: "01711000000",
        customerAddress: "12 Station Road, Dhaka",
        deliveryAddress: "12 Station Road, Dhaka",
        orderDate: "2026-10-20",
        deliveryDate: null,
        customerRef: "PO-77",
        createdBy: manager.id,
        totals: {
          sell: "28500.00",
          buy: "22000.00",
          margin: "6500.00",
          marginPercent: 22.8,
        },
      });
      expect(order?.items).toMatchObject([
        {
          productId: c.bread.id,
          productName: "Bread poly packet",
          specText: "10×14 in / 40 micron",
          supplierId: c.suzinas.id,
          quantity: 5000,
          sellPrice: "2.50",
          buyPrice: "2.00",
          sellTotal: "12500.00",
          buyTotal: "10000.00",
        },
        { productId: c.carryBag.id, supplierId: c.rahim.id, quantity: 2000 },
        { productId: c.sweetBox.id, supplierId: c.suzinas.id, quantity: 1000 },
      ]);
      expect(order?.workOrders).toMatchObject([
        {
          letter: "A",
          woNo: `WO-${number}-A`,
          supplierId: c.suzinas.id,
          supplierName: "Suzinas",
          supplierPhone: "01811000000",
          supplierAddress: "Plot 4, Tongi BSCIC",
          status: "pending",
          itemCount: 2,
          quantity: 6000,
        },
        {
          letter: "B",
          woNo: `WO-${number}-B`,
          supplierId: c.rahim.id,
          supplierName: "Rahim Plastics",
          itemCount: 1,
          quantity: 2000,
        },
      ]);
      const [itemA, , itemC] = order!.items;
      expect(itemA!.workOrderId).toBe(order!.workOrders[0]!.id);
      expect(itemC!.workOrderId).toBe(order!.workOrders[0]!.id);

      const logged = await tx
        .select({ entityType: activityLog.entityType })
        .from(activityLog)
        .where(eq(activityLog.orderId, id));
      expect(logged.map((row) => row.entityType).sort()).toEqual([
        "order_items",
        "order_items",
        "order_items",
        "orders",
        "work_orders",
        "work_orders",
      ]);
    },
  );
});

function bagOrder(c: Awaited<ReturnType<typeof seedCatalogue>>) {
  return {
    customerId: c.highwaySweets.id,
    orderDate: "2026-10-20",
    items: [{ productId: c.carryBag.id, quantity: 500 }],
  };
}

const seqOf = (orderNo: string) => Number(orderNo.split("-")[2]);

describe("snapshot", () => {
  dbTest(
    "keeps the Order's copies when the Customer, Product or Supplier change later",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const c = await seedCatalogue(tx);
      const { id } = await orders.create(admin, bagOrder(c), { executor: tx });
      const before = await orders.get(admin, id, { executor: tx });

      await products.update(
        admin,
        c.carryBag.id,
        {
          supplierId: c.suzinas.id,
          name: "Carry bag XL",
          sellPrice: "9.00",
          buyPrice: "7.00",
        },
        { executor: tx },
      );
      await customers.update(
        admin,
        c.highwaySweets.id,
        { name: "Highway Sweets Ltd", phone: "01999999999", address: "Uttara" },
        { executor: tx },
      );
      await suppliers.update(
        admin,
        c.rahim.id,
        {
          name: "Rahim Poly",
          phone: "01888888888",
          whatsapp: "01888888888",
          address: "Savar",
        },
        { executor: tx },
      );

      expect(await orders.get(admin, id, { executor: tx })).toEqual(before);
    },
  );
});

describe("numbering", () => {
  dbTest("gives each new Order the next number of the year", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);

    const first = await orders.create(staff, bagOrder(c), { executor: tx });
    const second = await orders.create(staff, bagOrder(c), { executor: tx });

    expect(seqOf(second.orderNo)).toBe(seqOf(first.orderNo) + 1);
  });

  // Two saves on separate connections, both rolled back (ADR 0002). The
  // second waits on the year's counter until the first ends, so it can never
  // take the same number while the first might still commit.
  it("makes a concurrent save wait for the number", async () => {
    let finishFirst!: () => void;
    const firstDone = new Promise<void>((resolve) => (finishFirst = resolve));
    let firstNo = "";
    let firstSaved!: () => void;
    const firstHasNumber = new Promise<void>((r) => (firstSaved = r));

    const first = inRollback(async (tx) => {
      const actor = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      ({ orderNo: firstNo } = await orders.create(actor, bagOrder(c), {
        executor: tx,
      }));
      firstSaved();
      await firstDone;
    });
    await firstHasNumber;

    let secondNo = "";
    const second = inRollback(async (tx) => {
      const actor = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      ({ orderNo: secondNo } = await orders.create(actor, bagOrder(c), {
        executor: tx,
      }));
    });
    // Seed the second Customer's catalogue, then still be waiting.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(secondNo).toBe("");

    finishFirst();
    await Promise.all([first, second]);
    // The first rolled back, so its number was never used.
    expect(secondNo).toBe(firstNo);
  });
});

describe("get", () => {
  dbTest("never hands Staff the Buy totals or Margin", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);
    const { id } = await orders.create(staff, bagOrder(c), { executor: tx });

    const order = await orders.get(staff, id, { executor: tx });

    expect(order?.totals).toEqual({
      sell: "2000.00",
      buy: null,
      margin: null,
      marginPercent: null,
    });
    expect(order?.items).toMatchObject([
      { sellTotal: "2000.00", buyTotal: null },
    ]);
    expect((await orders.get(admin, id, { executor: tx }))?.totals).toEqual({
      sell: "2000.00",
      buy: "1500.00",
      margin: "500.00",
      marginPercent: 25,
    });
  });
});

describe("create rules", () => {
  dbTest("keeps a typed delivery address over the Customer's", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);

    const { id } = await orders.create(
      staff,
      { ...bagOrder(c), deliveryAddress: "Shop 3, Gulshan 2" },
      { executor: tx },
    );

    expect(await orders.get(staff, id, { executor: tx })).toMatchObject({
      deliveryAddress: "Shop 3, Gulshan 2",
      customerAddress: "12 Station Road, Dhaka",
    });
  });

  dbTest("refuses the same Product twice", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);
    const line = { productId: c.bread.id, quantity: 100 };

    await expect(
      orders.create(
        staff,
        { ...bagOrder(c), items: [line, { ...line, quantity: 200 }] },
        { executor: tx },
      ),
    ).rejects.toThrow(
      new UserInputError("A Product can only be on an Order once."),
    );
  });

  dbTest("takes only whole pieces above 0", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);
    const order = (quantity: number) =>
      orders.create(
        staff,
        { ...bagOrder(c), items: [{ productId: c.bread.id, quantity }] },
        { executor: tx },
      );

    await expect(order(0)).rejects.toThrow(
      new UserInputError("Quantity must be more than 0."),
    );
    await expect(order(2.5)).rejects.toThrow(
      new UserInputError("Quantity must be whole pieces."),
    );
  });

  dbTest("needs at least one item", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);

    await expect(
      orders.create(staff, { ...bagOrder(c), items: [] }, { executor: tx }),
    ).rejects.toThrow(new UserInputError("Add at least one product."));
  });

  dbTest("refuses a deactivated Customer", async (tx) => {
    const admin = await seedActor(tx, "admin");
    const c = await seedCatalogue(tx);
    await customers.setActive(admin, c.highwaySweets.id, false, {
      executor: tx,
    });

    await expect(
      orders.create(admin, bagOrder(c), { executor: tx }),
    ).rejects.toThrow(new UserInputError("Pick an active Customer."));
  });

  dbTest(
    "refuses a deactivated Product, one whose Supplier is deactivated, or another Customer's",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const c = await seedCatalogue(tx);
      const other = await customers.create(
        admin,
        { name: "Lucky Bakery", phone: "01711000001", address: "Mirpur 10" },
        { executor: tx },
      );
      const theirs = await products.create(
        admin,
        {
          customerId: other.id,
          supplierId: c.suzinas.id,
          name: "Bread poly packet",
          sellPrice: "2.80",
          buyPrice: "2.00",
        },
        { executor: tx },
      );
      await products.setActive(admin, c.sweetBox.id, false, { executor: tx });
      await suppliers.setActive(admin, c.rahim.id, false, { executor: tx });
      const refused = new UserInputError(
        "A Product on this Order is no longer offered for this Customer. Remove it and try again.",
      );

      for (const productId of [c.sweetBox.id, c.carryBag.id, theirs.id]) {
        await expect(
          orders.create(
            admin,
            { ...bagOrder(c), items: [{ productId, quantity: 10 }] },
            { executor: tx },
          ),
        ).rejects.toThrow(refused);
      }
    },
  );
});

describe("price override", () => {
  dbTest(
    "lets a Manager set a line's own prices, logged as a change to the Product's",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const c = await seedCatalogue(tx);

      const { id } = await orders.create(
        manager,
        {
          ...bagOrder(c),
          items: [
            { productId: c.carryBag.id, quantity: 500, sellPrice: "3.75" },
            { productId: c.bread.id, quantity: 100 },
          ],
        },
        { executor: tx },
      );

      const order = await orders.get(manager, id, { executor: tx });
      expect(order?.items).toMatchObject([
        { sellPrice: "3.75", buyPrice: "3.00", sellTotal: "1875.00" },
        { sellPrice: "2.50", buyPrice: "2.00" },
      ]);
      const updates = await tx
        .select({
          entityId: activityLog.entityId,
          changes: activityLog.changes,
        })
        .from(activityLog)
        .where(
          and(eq(activityLog.orderId, id), eq(activityLog.action, "update")),
        );
      expect(updates).toEqual([
        {
          entityId: order!.items[0]!.id,
          changes: {
            sell_price: { from: 4, to: 3.75 },
            sell_total: { from: 2000, to: 1875 },
          },
        },
      ]);
    },
  );

  dbTest("refuses Staff a price of their own", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);

    await expect(
      orders.create(
        staff,
        {
          ...bagOrder(c),
          items: [
            { productId: c.carryBag.id, quantity: 500, buyPrice: "2.50" },
          ],
        },
        { executor: tx },
      ),
    ).rejects.toThrow(NotAllowedError);
  });
});

describe("options", () => {
  dbTest(
    "offers only the Customer's active Products with an active Supplier",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const c = await seedCatalogue(tx);
      await suppliers.setActive(admin, c.rahim.id, false, { executor: tx });
      await products.setActive(admin, c.sweetBox.id, false, { executor: tx });

      expect(
        await orders.productOptions(admin, c.highwaySweets.id, {
          executor: tx,
        }),
      ).toEqual([
        {
          id: c.bread.id,
          code: c.bread.code,
          name: "Bread poly packet",
          specText: "10×14 in / 40 micron",
          sellPrice: "2.50",
          buyPrice: "2.00",
          supplier: { id: c.suzinas.id, name: "Suzinas" },
        },
      ]);
    },
  );
});
