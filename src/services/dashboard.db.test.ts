import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import {
  orders as ordersTable,
  profiles,
  workOrders as workOrdersTable,
} from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import { withUser } from "@/db/with-user";
import type { CurrentUser } from "@/lib/auth";
import type { OrderStatus } from "@/lib/orders";
import type { Role } from "@/lib/permissions";
import { dashboard } from "@/services/dashboard";
import { orders } from "@/services/orders";
import { customers, suppliers } from "@/services/parties";
import { products } from "@/services/products";

// The project's database holds other Orders, so counts are compared before
// and after seeding, and every test Order is dated 1999: the oldest, so they
// lead each Needs action group, and "today" is 15 Feb 1999 for the month
// figures. Their numbers are this year's, so they are the newest Orders.
const TODAY = "1999-02-15";

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

// Highway Sweets buys bread packets (Suzinas, Tk 2.50 / 2.00) and carry
// bags (Rahim Plastics, Tk 4.00 / 3.00). Orders:
//   P  1999-01-05  5,000 bread + 1,000 bags  created, both WOs not sent
//   R  1999-01-10  1,000 bread               wo_sent, WO and Challan need re-send
//   K  1999-01-12  1,000 bags                wo_sent, WO cancelled, supplier not told
//   D  1999-02-03  1,000 bread               delivered, WO sent
//   I  1999-02-08  2,000 bread               invoiced, WO sent, Invoice dated 9 Feb
//   X  1999-02-10  1,000 bread               cancelled, its WO never sent
async function seedOrders(tx: Tx) {
  const admin = await seedActor(tx, "admin");
  const executor = { executor: tx };
  const highway = await customers.create(
    admin,
    { name: "Highway Sweets", phone: "01711000000", address: "Dhaka" },
    executor,
  );
  const supplier = (name: string, phone: string) =>
    suppliers.create(
      admin,
      { name, phone, whatsapp: phone, address: "Tongi" },
      executor,
    );
  const suzinas = await supplier("Suzinas", "01811000000");
  const rahim = await supplier("Rahim Plastics", "01811000001");
  const bread = await products.create(
    admin,
    {
      customerId: highway.id,
      supplierId: suzinas.id,
      name: "Bread poly packet",
      sellPrice: "2.50",
      buyPrice: "2.00",
    },
    executor,
  );
  const bag = await products.create(
    admin,
    {
      customerId: highway.id,
      supplierId: rahim.id,
      name: "Carry bag",
      sellPrice: "4.00",
      buyPrice: "3.00",
    },
    executor,
  );

  const update = <T>(fn: (sp: Tx) => Promise<T>) => withUser(admin, fn, tx);
  const order = async (
    orderDate: string,
    items: { productId: string; quantity: number }[],
    status: OrderStatus,
    fields: Partial<typeof ordersTable.$inferInsert> = {},
  ) => {
    const created = await orders.create(
      admin,
      { customerId: highway.id, orderDate, items },
      executor,
    );
    const [row] = await update((sp) =>
      sp
        .update(ordersTable)
        .set({ status, ...fields })
        .where(eq(ordersTable.id, created.id))
        .returning({ challanNo: ordersTable.challanNo }),
    );
    const wos = await tx
      .select()
      .from(workOrdersTable)
      .where(eq(workOrdersTable.orderId, created.id))
      .orderBy(workOrdersTable.letter);
    return { ...created, challanNo: row!.challanNo, workOrders: wos };
  };
  const setWorkOrder = (
    id: string,
    fields: Partial<typeof workOrdersTable.$inferInsert>,
  ) =>
    update((sp) =>
      sp.update(workOrdersTable).set(fields).where(eq(workOrdersTable.id, id)),
    );

  const p = await order(
    "1999-01-05",
    [
      { productId: bread.id, quantity: 5000 },
      { productId: bag.id, quantity: 1000 },
    ],
    "created",
  );
  const r = await order(
    "1999-01-10",
    [{ productId: bread.id, quantity: 1000 }],
    "wo_sent",
    { challanNeedsResend: true },
  );
  await setWorkOrder(r.workOrders[0]!.id, {
    status: "sent",
    sentAt: new Date("1999-01-10T05:00:00Z"),
    needsResend: true,
  });
  const k = await order(
    "1999-01-12",
    [{ productId: bag.id, quantity: 1000 }],
    "wo_sent",
  );
  await setWorkOrder(k.workOrders[0]!.id, {
    status: "cancelled",
    sentAt: new Date("1999-01-12T05:00:00Z"),
    cancelledAt: new Date("1999-01-14T05:00:00Z"),
  });
  const d = await order(
    "1999-02-03",
    [{ productId: bread.id, quantity: 1000 }],
    "delivered",
  );
  await setWorkOrder(d.workOrders[0]!.id, { status: "sent" });
  const i = await order(
    "1999-02-08",
    [{ productId: bread.id, quantity: 2000 }],
    "invoiced",
    { invoiceDate: "1999-02-09" },
  );
  await setWorkOrder(i.workOrders[0]!.id, { status: "sent" });
  const x = await order(
    "1999-02-10",
    [{ productId: bread.id, quantity: 1000 }],
    "cancelled",
  );
  return { admin, p, r, k, d, i, x };
}

const overview = (actor: CurrentUser, tx: Tx) =>
  dashboard.overview(actor, { executor: tx, today: TODAY });

const group = (
  result: Awaited<ReturnType<typeof dashboard.overview>>,
  kind: string,
) => result.needsAction.find((g) => g.kind === kind)!;

describe("Orders by status", () => {
  dbTest("counts every Order by its status", async (tx) => {
    const manager = await seedActor(tx, "manager");
    const before = await overview(manager, tx);
    await seedOrders(tx);

    const after = await overview(manager, tx);

    const added = Object.fromEntries(
      Object.entries(after.statusCounts).map(([status, n]) => [
        status,
        n - before.statusCounts[status as OrderStatus],
      ]),
    );
    expect(added).toEqual({
      created: 1,
      wo_sent: 2,
      delivered: 1,
      invoiced: 1,
      completed: 0,
      cancelled: 1,
    });
  });
});

describe("This month and the last 6 months", () => {
  dbTest(
    "sums today's month and the five before it, leaving out cancelled Orders",
    async (tx) => {
      const { admin } = await seedOrders(tx);

      const result = await overview(admin, tx);

      expect(result.thisMonth).toEqual({
        month: "1999-02",
        orders: 2,
        sell: "7500.00",
        buy: "6000.00",
        margin: "1500.00",
        marginPercent: 20,
      });
      const empty = { sell: "0.00", buy: "0.00", margin: "0.00" };
      expect(result.months).toEqual([
        { month: "1998-09", ...empty },
        { month: "1998-10", ...empty },
        { month: "1998-11", ...empty },
        { month: "1998-12", ...empty },
        {
          month: "1999-01",
          sell: "23000.00",
          buy: "18000.00",
          margin: "5000.00",
        },
        {
          month: "1999-02",
          sell: "7500.00",
          buy: "6000.00",
          margin: "1500.00",
        },
      ]);
    },
  );

  dbTest("gives Staff the Order count and Sell total only", async (tx) => {
    await seedOrders(tx);
    const staff = await seedActor(tx, "staff");

    const result = await overview(staff, tx);

    expect(result.thisMonth).toEqual({
      month: "1999-02",
      orders: 2,
      sell: "7500.00",
      buy: null,
      margin: null,
      marginPercent: null,
    });
    expect(result.months).toBeNull();
  });
});

describe("Needs action", () => {
  dbTest(
    "lists the five groups in SPEC order, oldest first, two items each",
    async (tx) => {
      const manager = await seedActor(tx, "manager");
      const before = await overview(manager, tx);
      const s = await seedOrders(tx);

      const after = await overview(manager, tx);

      expect(after.needsAction.map((g) => g.kind)).toEqual([
        "cancelledWorkOrders",
        "needsResend",
        "unsentWorkOrders",
        "toInvoice",
        "toComplete",
      ]);
      expect(
        after.needsAction.map(
          (g, index) => g.total - before.needsAction[index]!.total,
        ),
      ).toEqual([1, 2, 2, 1, 1]);

      const [pa, pb] = s.p.workOrders;
      expect(group(after, "cancelledWorkOrders").items[0]).toEqual({
        orderId: s.k.id,
        number: s.k.workOrders[0]!.woNo,
        party: "Rahim Plastics",
        detail: "Cancelled 14 Jan 1999",
      });
      expect(group(after, "needsResend").items).toEqual([
        {
          orderId: s.r.id,
          number: s.r.workOrders[0]!.woNo,
          party: "Suzinas",
          detail: "Work Order",
        },
        {
          orderId: s.r.id,
          number: s.r.challanNo,
          party: "Highway Sweets",
          detail: "Challan",
        },
      ]);
      expect(group(after, "unsentWorkOrders").items).toEqual([
        {
          orderId: s.p.id,
          number: pa!.woNo,
          party: "Suzinas",
          detail: `${s.p.orderNo} · Highway Sweets`,
        },
        {
          orderId: s.p.id,
          number: pb!.woNo,
          party: "Rahim Plastics",
          detail: `${s.p.orderNo} · Highway Sweets`,
        },
      ]);
      expect(group(after, "toInvoice").items[0]).toEqual({
        orderId: s.d.id,
        number: s.d.orderNo,
        party: "Highway Sweets",
        detail: "Ordered 3 Feb 1999",
      });
      expect(group(after, "toComplete").items[0]).toEqual({
        orderId: s.i.id,
        number: s.i.orderNo,
        party: "Highway Sweets",
        detail: "Invoiced 9 Feb 1999 · 6 days",
      });
    },
  );

  dbTest(
    "drops a cancelled Work Order once its supplier is told",
    async (tx) => {
      const s = await seedOrders(tx);
      const before = await overview(s.admin, tx);

      await orders.acknowledgeCancel(s.admin, s.k.id, s.k.workOrders[0]!.id, {
        executor: tx,
      });

      const after = await overview(s.admin, tx);
      expect(group(after, "cancelledWorkOrders").total).toBe(
        group(before, "cancelledWorkOrders").total - 1,
      );
    },
  );
});

describe("Last 10 orders", () => {
  dbTest("lists the newest Orders first", async (tx) => {
    const s = await seedOrders(tx);
    const staff = await seedActor(tx, "staff");

    const { recent } = await overview(staff, tx);

    expect(recent.length).toBeLessThanOrEqual(10);
    expect(recent.slice(0, 6).map((row) => row.orderNo)).toEqual(
      [s.x, s.i, s.d, s.k, s.r, s.p].map((o) => o.orderNo),
    );
    expect(recent[0]).toMatchObject({ sellTotal: "2500.00", margin: null });
  });
});
