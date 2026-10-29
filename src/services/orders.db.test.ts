import { and, eq, type SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Tx } from "@/db/client";
import {
  activityLog,
  orders as ordersTable,
  profiles,
  workOrders,
} from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { withUser } from "@/db/with-user";
import { dbTest, inRollback } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import { formatDateTime, todayInDhaka } from "@/lib/dates";
import type { Role } from "@/lib/permissions";
import { orders, type OrderFilters } from "@/services/orders";
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

      // Only the WhatsApp number for "Open WhatsApp chat" is the live one
      // (SPEC §8.4); nothing printed uses it.
      expect(await orders.get(admin, id, { executor: tx })).toEqual({
        ...before,
        workOrders: before!.workOrders.map((wo) => ({
          ...wo,
          supplierWhatsapp: "01888888888",
        })),
      });
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

describe("list", () => {
  dbTest(
    "shows each Order's number, Customer, date, status and Sell total, newest first",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const first = await orders.create(staff, bagOrder(c), { executor: tx });
      const second = await orders.create(
        staff,
        {
          ...bagOrder(c),
          orderDate: "2026-10-21",
          items: [{ productId: c.bread.id, quantity: 1000 }],
        },
        { executor: tx },
      );
      const list = (actor: CurrentUser) =>
        orders.list(
          actor,
          { customerId: c.highwaySweets.id },
          { executor: tx },
        );

      expect(await list(admin)).toEqual({
        total: 2,
        rows: [
          {
            id: second.id,
            orderNo: second.orderNo,
            customerId: c.highwaySweets.id,
            customerName: "Highway Sweets",
            customerRef: null,
            orderDate: "2026-10-21",
            status: "created",
            workOrders: { sent: 0, total: 1 },
            needsResend: false,
            sellTotal: "2500.00",
            margin: { amount: "500.00", percent: 20 },
          },
          expect.objectContaining({
            id: first.id,
            sellTotal: "2000.00",
            margin: { amount: "500.00", percent: 25 },
          }),
        ],
      });
      const { rows } = await list(staff);
      expect(rows.map((row) => row.margin)).toEqual([null, null]);
    },
  );

  dbTest(
    "searches order number, Customer and Customer reference",
    async (tx) => {
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const plain = await orders.create(staff, bagOrder(c), { executor: tx });
      const withRef = await orders.create(
        staff,
        { ...bagOrder(c), customerRef: "PO-77/B" },
        { executor: tx },
      );
      const found = async (query: string) =>
        (
          await orders.list(
            staff,
            { query, customerId: c.highwaySweets.id },
            { executor: tx },
          )
        ).rows.map((row) => row.id);

      expect(await found(plain.orderNo.toLowerCase())).toEqual([plain.id]);
      expect(await found("po-77")).toEqual([withRef.id]);
      expect(await found("highway")).toEqual([withRef.id, plain.id]);
      expect(await found("nothing like it")).toEqual([]);
    },
  );

  dbTest("filters by status, Supplier and order date range", async (tx) => {
    const staff = await seedActor(tx, "staff");
    const c = await seedCatalogue(tx);
    const create = (orderDate: string, productId: string) =>
      orders.create(
        staff,
        {
          ...bagOrder(c),
          orderDate,
          items: [{ productId, quantity: 100 }],
        },
        { executor: tx },
      );
    const bags = await create("2026-09-30", c.carryBag.id);
    const bread = await create("2026-10-01", c.bread.id);
    const boxes = await create("2026-10-31", c.sweetBox.id);
    await withUser(
      staff,
      (sp) =>
        sp
          .update(ordersTable)
          .set({ status: "delivered" })
          .where(eq(ordersTable.id, bread.id)),
      tx,
    );
    const found = async (filters: OrderFilters) =>
      (
        await orders.list(
          staff,
          { ...filters, customerId: c.highwaySweets.id },
          { executor: tx },
        )
      ).rows.map((row) => row.id);

    expect(await found({ status: "delivered" })).toEqual([bread.id]);
    expect(await found({ supplierId: c.suzinas.id })).toEqual([
      boxes.id,
      bread.id,
    ]);
    expect(await found({ supplierId: c.rahim.id })).toEqual([bags.id]);
    expect(await found({ from: "2026-10-01", to: "2026-10-31" })).toEqual([
      boxes.id,
      bread.id,
    ]);
    expect(await found({ to: "2026-09-30" })).toEqual([bags.id]);
  });

  dbTest(
    "counts sent Work Orders, leaving out cancelled ones, and flags Needs re-send",
    async (tx) => {
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const twoSuppliers = {
        ...bagOrder(c),
        items: [
          { productId: c.bread.id, quantity: 100 },
          { productId: c.carryBag.id, quantity: 100 },
        ],
      };
      const woChanged = await orders.create(staff, twoSuppliers, {
        executor: tx,
      });
      const challanChanged = await orders.create(staff, bagOrder(c), {
        executor: tx,
      });
      const oneCancelled = await orders.create(staff, twoSuppliers, {
        executor: tx,
      });
      const set = (
        table: typeof workOrders | typeof ordersTable,
        values: Record<string, unknown>,
        where: SQL,
      ) =>
        withUser(staff, (sp) => sp.update(table).set(values).where(where), tx);
      const wo = (orderId: string, letter: string) =>
        and(eq(workOrders.orderId, orderId), eq(workOrders.letter, letter))!;
      await set(
        workOrders,
        { status: "sent", needsResend: true },
        wo(woChanged.id, "A"),
      );
      await set(
        ordersTable,
        { challanNeedsResend: true },
        eq(ordersTable.id, challanChanged.id),
      );
      await set(workOrders, { status: "sent" }, wo(oneCancelled.id, "A"));
      await set(workOrders, { status: "cancelled" }, wo(oneCancelled.id, "B"));

      const { rows } = await orders.list(
        staff,
        { customerId: c.highwaySweets.id },
        { executor: tx },
      );
      expect(
        rows.map(({ workOrders, needsResend }) => ({
          workOrders,
          needsResend,
        })),
      ).toEqual([
        { workOrders: { sent: 1, total: 1 }, needsResend: false },
        { workOrders: { sent: 0, total: 1 }, needsResend: true },
        { workOrders: { sent: 1, total: 2 }, needsResend: true },
      ]);
    },
  );
});

// What the edit form sends back for an Order as it was loaded: its header,
// its lines and the optimistic-lock token (SPEC §5.5).
function editOf(order: NonNullable<Awaited<ReturnType<typeof orders.get>>>) {
  return {
    updatedAt: order.updatedAt?.toISOString() ?? null,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate ?? "",
    customerRef: order.customerRef ?? "",
    deliveryAddress: order.deliveryAddress,
    notes: order.notes ?? "",
    invoiceNote: order.invoiceNote ?? "",
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };
}

describe("update", () => {
  dbTest(
    "changes the header and quantities but keeps each line's snapshot",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const { id } = await orders.create(staff, bagOrder(c), { executor: tx });
      const loaded = await orders.get(staff, id, { executor: tx });
      await products.update(
        admin,
        c.carryBag.id,
        {
          supplierId: c.rahim.id,
          name: "Carry bag XL",
          sellPrice: "9.00",
          buyPrice: "7.00",
        },
        { executor: tx },
      );

      await orders.update(
        staff,
        id,
        {
          ...editOf(loaded!),
          deliveryDate: "2026-10-25",
          customerRef: "PO-91",
          notes: "Call before delivery",
          items: [{ productId: c.carryBag.id, quantity: 800 }],
        },
        { executor: tx },
      );

      const order = await orders.get(admin, id, { executor: tx });
      expect(order).toMatchObject({
        orderDate: "2026-10-20",
        deliveryDate: "2026-10-25",
        customerRef: "PO-91",
        notes: "Call before delivery",
        updatedBy: staff.id,
      });
      expect(order?.items).toMatchObject([
        {
          productName: "Carry bag large",
          quantity: 800,
          sellPrice: "4.00",
          buyPrice: "3.00",
          sellTotal: "3200.00",
        },
      ]);
    },
  );

  dbTest(
    "refuses to overwrite a save made since the form loaded",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const { id } = await orders.create(staff, bagOrder(c), { executor: tx });
      const loaded = editOf((await orders.get(staff, id, { executor: tx }))!);

      await orders.update(
        manager,
        id,
        { ...loaded, customerRef: "PO-1" },
        { executor: tx },
      );
      const saved = await orders.get(staff, id, { executor: tx });

      await expect(
        orders.update(
          staff,
          id,
          { ...loaded, customerRef: "PO-2" },
          { executor: tx },
        ),
      ).rejects.toThrow(
        new UserInputError(
          `This order was changed by Test manager at ${formatDateTime(saved!.updatedAt!)}. Reload to see their changes.`,
        ),
      );
      expect(await orders.get(staff, id, { executor: tx })).toEqual(saved);

      // Reloaded, the same edit goes through.
      await orders.update(
        staff,
        id,
        { ...editOf(saved!), customerRef: "PO-2" },
        { executor: tx },
      );
      expect((await orders.get(staff, id, { executor: tx }))?.customerRef).toBe(
        "PO-2",
      );
    },
  );

  dbTest(
    "deletes a pending Work Order whose Supplier has no lines left and gives a new Supplier the next unused letter",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const plastech = await suppliers.create(
        admin,
        {
          name: "Plastech",
          phone: "01811000002",
          whatsapp: "01811000002",
          address: "Gazipur",
        },
        { executor: tx },
      );
      const tray = await products.create(
        admin,
        {
          customerId: c.highwaySweets.id,
          supplierId: plastech.id,
          name: "Cake tray",
          sellPrice: "6.00",
          buyPrice: "5.00",
        },
        { executor: tx },
      );
      const { id, orderNo } = await orders.create(
        staff,
        {
          ...bagOrder(c),
          items: [
            { productId: c.bread.id, quantity: 100 },
            { productId: c.carryBag.id, quantity: 200 },
          ],
        },
        { executor: tx },
      );
      const number = orderNo.slice("ORD-".length);
      const edit = async (items: { productId: string; quantity: number }[]) =>
        orders.update(
          staff,
          id,
          {
            ...editOf((await orders.get(staff, id, { executor: tx }))!),
            items,
          },
          { executor: tx },
        );

      // Rahim Plastics' carry bag goes: WO-…-B is deleted.
      await edit([{ productId: c.bread.id, quantity: 100 }]);
      expect(
        (await orders.get(staff, id, { executor: tx }))?.workOrders,
      ).toMatchObject([{ woNo: `WO-${number}-A`, supplierId: c.suzinas.id }]);

      // A new Supplier gets C, never B again; Suzinas keeps A.
      await edit([
        { productId: c.bread.id, quantity: 100 },
        { productId: tray.id, quantity: 50 },
      ]);
      const order = await orders.get(staff, id, { executor: tx });
      expect(order?.workOrders).toMatchObject([
        { letter: "A", supplierId: c.suzinas.id, itemCount: 1 },
        {
          letter: "C",
          woNo: `WO-${number}-C`,
          supplierId: plastech.id,
          supplierName: "Plastech",
          status: "pending",
          itemCount: 1,
          quantity: 50,
        },
      ]);
      expect(order?.items).toMatchObject([
        { productId: c.bread.id, workOrderId: order!.workOrders[0]!.id },
        {
          productId: tray.id,
          productName: "Cake tray",
          sellPrice: "6.00",
          workOrderId: order!.workOrders[1]!.id,
        },
      ]);
    },
  );

  dbTest(
    "refuses an Order once a Work Order or the Challan has gone out",
    async (tx) => {
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const woSent = await orders.create(staff, bagOrder(c), { executor: tx });
      const challanSent = await orders.create(staff, bagOrder(c), {
        executor: tx,
      });
      await withUser(
        staff,
        async (sp) => {
          await sp
            .update(workOrders)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(workOrders.orderId, woSent.id));
          await sp
            .update(ordersTable)
            .set({ challanDownloadedAt: new Date() })
            .where(eq(ordersTable.id, challanSent.id));
        },
        tx,
      );

      for (const { id } of [woSent, challanSent]) {
        const loaded = await orders.get(staff, id, { executor: tx });
        await expect(
          orders.update(staff, id, editOf(loaded!), { executor: tx }),
        ).rejects.toThrow(
          new UserInputError(
            "Documents have been sent for this order, so it can't be edited here.",
          ),
        );
      }
    },
  );

  dbTest(
    "keeps a line whose Product was deactivated, but won't add it back once removed",
    async (tx) => {
      const admin = await seedActor(tx, "admin");
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const { id } = await orders.create(
        staff,
        {
          ...bagOrder(c),
          items: [
            { productId: c.bread.id, quantity: 100 },
            { productId: c.carryBag.id, quantity: 200 },
          ],
        },
        { executor: tx },
      );
      await products.setActive(admin, c.carryBag.id, false, { executor: tx });
      const loaded = await orders.get(staff, id, { executor: tx });
      expect(loaded?.items.map((item) => item.deactivated)).toEqual([
        false,
        true,
      ]);

      await orders.update(
        staff,
        id,
        {
          ...editOf(loaded!),
          items: [
            { productId: c.bread.id, quantity: 100 },
            { productId: c.carryBag.id, quantity: 300 },
          ],
        },
        { executor: tx },
      );
      const kept = await orders.get(staff, id, { executor: tx });
      expect(kept?.items[1]).toMatchObject({ quantity: 300 });

      await orders.update(
        staff,
        id,
        {
          ...editOf(kept!),
          items: [{ productId: c.bread.id, quantity: 100 }],
        },
        { executor: tx },
      );
      const removed = await orders.get(staff, id, { executor: tx });
      await expect(
        orders.update(
          staff,
          id,
          {
            ...editOf(removed!),
            items: [
              { productId: c.bread.id, quantity: 100 },
              { productId: c.carryBag.id, quantity: 300 },
            ],
          },
          { executor: tx },
        ),
      ).rejects.toThrow(
        new UserInputError(
          "A Product on this Order is no longer offered for this Customer. Remove it and try again.",
        ),
      );
    },
  );
});

describe("refreshPrices", () => {
  dbTest(
    "re-copies each line's prices from its Product but never its Supplier",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const staff = await seedActor(tx, "staff");
      const c = await seedCatalogue(tx);
      const { id } = await orders.create(
        manager,
        {
          ...bagOrder(c),
          items: [
            { productId: c.bread.id, quantity: 100, sellPrice: "2.20" },
            { productId: c.carryBag.id, quantity: 200 },
          ],
        },
        { executor: tx },
      );
      const loaded = await orders.get(manager, id, { executor: tx });
      // The carry bag moves to Suzinas at a new price.
      await products.update(
        manager,
        c.carryBag.id,
        {
          supplierId: c.suzinas.id,
          name: "Carry bag large",
          sellPrice: "4.50",
          buyPrice: "3.20",
        },
        { executor: tx },
      );
      const token = { updatedAt: loaded!.updatedAt?.toISOString() ?? null };

      await expect(
        orders.refreshPrices(staff, id, token, { executor: tx }),
      ).rejects.toThrow(NotAllowedError);
      await orders.refreshPrices(manager, id, token, { executor: tx });

      const order = await orders.get(manager, id, { executor: tx });
      expect(order?.items).toMatchObject([
        { productId: c.bread.id, sellPrice: "2.50", buyPrice: "2.00" },
        {
          productId: c.carryBag.id,
          supplierId: c.rahim.id,
          sellPrice: "4.50",
          buyPrice: "3.20",
          sellTotal: "900.00",
        },
      ]);
      expect(order?.workOrders.map((wo) => wo.supplierId)).toEqual([
        c.suzinas.id,
        c.rahim.id,
      ]);

      // The token moved on, so a second refresh from the same page fails.
      await expect(
        orders.refreshPrices(manager, id, token, { executor: tx }),
      ).rejects.toThrow(/^This order was changed by Test manager at /);
    },
  );
});
