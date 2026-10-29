import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { orders as ordersTable, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import { withUser } from "@/db/with-user";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import type { OrderStatus } from "@/lib/orders";
import { orders } from "@/services/orders";
import { customers, suppliers } from "@/services/parties";
import { products } from "@/services/products";
import { reports } from "@/services/reports";

// The project's database holds other Orders, so every test Order is dated
// 1999 and every report runs over 1999 only.
const YEAR_1999 = { from: "1999-01-01", to: "1999-12-31" };

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

// Highway Sweets buys bread packets (Suzinas) and carry bags (Rahim
// Plastics); Mitali Bakery buys sweet boxes (Suzinas). Orders:
//   A  1999-01-05  Highway Sweets  5,000 bread + 2,000 bags  completed
//   B  1999-01-20  Mitali Bakery   1,000 boxes               created
//   C  1999-02-10  Highway Sweets  1,000 bread               invoiced
//   X  1999-01-25  Highway Sweets  9,999 bags                cancelled
async function seedOrders(tx: Tx) {
  const admin = await seedActor(tx, "admin");
  const executor = { executor: tx };
  const highway = await customers.create(
    admin,
    { name: "Highway Sweets", phone: "01711000000", address: "Dhaka" },
    executor,
  );
  const mitali = await customers.create(
    admin,
    { name: "Mitali Bakery", phone: "01711000001", address: "Gazipur" },
    executor,
  );
  const suzinas = await suppliers.create(
    admin,
    {
      name: "Suzinas",
      phone: "01811000000",
      whatsapp: "01811000000",
      address: "Tongi",
    },
    executor,
  );
  const rahim = await suppliers.create(
    admin,
    {
      name: "Rahim Plastics",
      phone: "01811000001",
      whatsapp: "01811000001",
      address: "Narayanganj",
    },
    executor,
  );
  const product = (
    customerId: string,
    supplierId: string,
    name: string,
    sellPrice: string,
    buyPrice: string,
  ) =>
    products.create(
      admin,
      { customerId, supplierId, name, sellPrice, buyPrice },
      executor,
    );
  const bread = await product(
    highway.id,
    suzinas.id,
    "Bread poly packet",
    "2.50",
    "2.00",
  );
  const bag = await product(highway.id, rahim.id, "Carry bag", "4.00", "3.00");
  const box = await product(mitali.id, suzinas.id, "Sweet box", "8.00", "6.00");

  const order = async (
    customerId: string,
    orderDate: string,
    items: { productId: string; quantity: number }[],
    status: OrderStatus,
  ) => {
    const created = await orders.create(
      admin,
      { customerId, orderDate, items },
      executor,
    );
    if (status !== "created")
      await withUser(
        admin,
        (sp) =>
          sp
            .update(ordersTable)
            .set({ status })
            .where(eq(ordersTable.id, created.id)),
        tx,
      );
    return created;
  };
  const a = await order(
    highway.id,
    "1999-01-05",
    [
      { productId: bread.id, quantity: 5000 },
      { productId: bag.id, quantity: 2000 },
    ],
    "completed",
  );
  const b = await order(
    mitali.id,
    "1999-01-20",
    [{ productId: box.id, quantity: 1000 }],
    "created",
  );
  const c = await order(
    highway.id,
    "1999-02-10",
    [{ productId: bread.id, quantity: 1000 }],
    "invoiced",
  );
  const x = await order(
    highway.id,
    "1999-01-25",
    [{ productId: bag.id, quantity: 9999 }],
    "cancelled",
  );
  return {
    admin,
    highway,
    mitali,
    suzinas,
    rahim,
    bread,
    bag,
    box,
    a,
    b,
    c,
    x,
  };
}

describe("Margin by order", () => {
  dbTest(
    "lists each Order with its totals and Margin %, leaving out cancelled Orders",
    async (tx) => {
      const s = await seedOrders(tx);
      const manager = await seedActor(tx, "manager");

      const report = await reports.run(
        manager,
        { report: "orders", ...YEAR_1999 },
        { executor: tx },
      );

      expect(report.rows).toEqual([
        {
          id: s.c.id,
          orderNo: s.c.orderNo,
          customerName: "Highway Sweets",
          orderDate: "1999-02-10",
          sell: "2500.00",
          buy: "2000.00",
          margin: "500.00",
          marginPercent: 20,
        },
        {
          id: s.b.id,
          orderNo: s.b.orderNo,
          customerName: "Mitali Bakery",
          orderDate: "1999-01-20",
          sell: "8000.00",
          buy: "6000.00",
          margin: "2000.00",
          marginPercent: 25,
        },
        {
          id: s.a.id,
          orderNo: s.a.orderNo,
          customerName: "Highway Sweets",
          orderDate: "1999-01-05",
          sell: "20500.00",
          buy: "16000.00",
          margin: "4500.00",
          marginPercent: 22,
        },
      ]);
      expect(report.totals).toEqual({
        sell: "31000.00",
        buy: "24000.00",
        margin: "7000.00",
        marginPercent: 22.6,
      });
    },
  );
});

describe("date range", () => {
  dbTest("includes Orders dated on either end of the range", async (tx) => {
    const s = await seedOrders(tx);

    const report = await reports.run(
      s.admin,
      { report: "orders", from: "1999-01-20", to: "1999-02-10" },
      { executor: tx },
    );

    expect(report.rows.map((row) => row.orderNo)).toEqual([
      s.c.orderNo,
      s.b.orderNo,
    ]);
  });
});

describe("By month", () => {
  dbTest("sums the Orders of each month, oldest month first", async (tx) => {
    const s = await seedOrders(tx);

    const report = await reports.run(
      s.admin,
      { report: "months", ...YEAR_1999 },
      { executor: tx },
    );

    expect(report.rows).toEqual([
      {
        month: "1999-01",
        orders: 2,
        sell: "28500.00",
        buy: "22000.00",
        margin: "6500.00",
        marginPercent: 22.8,
      },
      {
        month: "1999-02",
        orders: 1,
        sell: "2500.00",
        buy: "2000.00",
        margin: "500.00",
        marginPercent: 20,
      },
    ]);
    expect(report.totals).toEqual({
      orders: 3,
      sell: "31000.00",
      buy: "24000.00",
      margin: "7000.00",
      marginPercent: 22.6,
    });
  });
});

describe("By customer", () => {
  dbTest(
    "sums each Customer's Orders, biggest Sell total first",
    async (tx) => {
      const s = await seedOrders(tx);

      const report = await reports.run(
        s.admin,
        { report: "customers", ...YEAR_1999 },
        { executor: tx },
      );

      expect(report.rows).toEqual([
        {
          customerId: s.highway.id,
          customerName: "Highway Sweets",
          orders: 2,
          sell: "23000.00",
          buy: "18000.00",
          margin: "5000.00",
          marginPercent: 21.7,
        },
        {
          customerId: s.mitali.id,
          customerName: "Mitali Bakery",
          orders: 1,
          sell: "8000.00",
          buy: "6000.00",
          margin: "2000.00",
          marginPercent: 25,
        },
      ]);
      expect(report.totals).toEqual({
        orders: 3,
        sell: "31000.00",
        buy: "24000.00",
        margin: "7000.00",
        marginPercent: 22.6,
      });
    },
  );
});

describe("By supplier", () => {
  dbTest(
    "counts each Supplier's Work Orders, pieces and Buy total, biggest first",
    async (tx) => {
      const s = await seedOrders(tx);

      const report = await reports.run(
        s.admin,
        { report: "suppliers", ...YEAR_1999 },
        { executor: tx },
      );

      expect(report.rows).toEqual([
        {
          supplierId: s.suzinas.id,
          supplierName: "Suzinas",
          workOrders: 3,
          quantity: 7000,
          buy: "18000.00",
        },
        {
          supplierId: s.rahim.id,
          supplierName: "Rahim Plastics",
          workOrders: 1,
          quantity: 2000,
          buy: "6000.00",
        },
      ]);
      expect(report.totals).toEqual({
        workOrders: 4,
        quantity: 9000,
        buy: "24000.00",
      });
    },
  );
});

describe("By product", () => {
  dbTest(
    "sums each Product's pieces, Sell, Buy and Margin, biggest Sell total first",
    async (tx) => {
      const s = await seedOrders(tx);

      const report = await reports.run(
        s.admin,
        { report: "products", ...YEAR_1999 },
        { executor: tx },
      );

      expect(report.rows).toEqual([
        {
          productId: s.bread.id,
          productCode: s.bread.code,
          productName: "Bread poly packet",
          customerName: "Highway Sweets",
          quantity: 6000,
          sell: "15000.00",
          buy: "12000.00",
          margin: "3000.00",
          marginPercent: 20,
        },
        {
          productId: s.bag.id,
          productCode: s.bag.code,
          productName: "Carry bag",
          customerName: "Highway Sweets",
          quantity: 2000,
          sell: "8000.00",
          buy: "6000.00",
          margin: "2000.00",
          marginPercent: 25,
        },
        {
          productId: s.box.id,
          productCode: s.box.code,
          productName: "Sweet box",
          customerName: "Mitali Bakery",
          quantity: 1000,
          sell: "8000.00",
          buy: "6000.00",
          margin: "2000.00",
          marginPercent: 25,
        },
      ]);
      expect(report.totals).toEqual({
        quantity: 9000,
        sell: "31000.00",
        buy: "24000.00",
        margin: "7000.00",
        marginPercent: 22.6,
      });
    },
  );
});

describe("Open orders", () => {
  dbTest(
    "lists Orders neither completed nor cancelled with their age in days, oldest first",
    async (tx) => {
      const s = await seedOrders(tx);

      const report = await reports.run(
        s.admin,
        { report: "open", ...YEAR_1999 },
        { executor: tx, today: "1999-03-01" },
      );

      expect(report.rows).toEqual([
        {
          id: s.b.id,
          orderNo: s.b.orderNo,
          customerName: "Mitali Bakery",
          orderDate: "1999-01-20",
          status: "created",
          ageDays: 40,
          sell: "8000.00",
        },
        {
          id: s.c.id,
          orderNo: s.c.orderNo,
          customerName: "Highway Sweets",
          orderDate: "1999-02-10",
          status: "invoiced",
          ageDays: 19,
          sell: "2500.00",
        },
      ]);
      expect(report.totals).toEqual({ sell: "10500.00" });
    },
  );
});

describe("who may run reports", () => {
  dbTest("refuses Staff, who may not see Margin", async (tx) => {
    const staff = await seedActor(tx, "staff");

    await expect(
      reports.run(staff, { report: "orders" }, { executor: tx }),
    ).rejects.toBeInstanceOf(NotAllowedError);
  });
});
