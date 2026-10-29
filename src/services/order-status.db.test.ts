import { and, asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest, inSavepoint } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import type { AssetStorage } from "@/services/company-settings";
import { documents } from "@/services/documents";
import { orderStatus } from "@/services/order-status";
import { orders } from "@/services/orders";
import { customers, suppliers } from "@/services/parties";
import { products } from "@/services/products";

// Nothing here prints a letterhead image.
const storage: AssetStorage = {
  async upload() {},
  async download() {
    return null;
  },
  async remove() {},
};

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

// SPEC §5.4: bread packets from Suzinas, carry bags from Rahim Plastics, so
// the Order has two Work Orders.
async function seed(tx: Tx) {
  const admin = await seedActor(tx, "admin");
  const executor = { executor: tx };
  const customer = await customers.create(
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
  const product = (name: string, supplierId: string) =>
    products.create(
      admin,
      {
        customerId: customer.id,
        supplierId,
        name,
        sellPrice: "2.50",
        buyPrice: "2.00",
      },
      executor,
    );
  const bread = await product("Bread poly packet", suzinas.id);
  const bag = await product("Carry bag large", rahim.id);
  const { id } = await orders.create(
    admin,
    {
      customerId: customer.id,
      orderDate: "2026-10-20",
      items: [
        { productId: bread.id, quantity: 5000 },
        { productId: bag.id, quantity: 2000 },
      ],
    },
    executor,
  );
  const read = () => orders.get(admin, id, executor).then((order) => order!);
  // The Order's optimistic-lock token as the page would carry it.
  const token = async () => (await read()).updatedAt?.toISOString() ?? null;
  const send = (
    actor: CurrentUser,
    ref: Parameters<typeof documents.send>[2],
  ) =>
    documents.send(
      actor,
      id,
      ref,
      { date: "2026-10-22", via: "download" },
      { executor: tx, storage },
    );
  const events = (action: string) =>
    tx
      .select({
        entityType: activityLog.entityType,
        entityLabel: activityLog.entityLabel,
        userName: activityLog.userName,
        details: activityLog.details,
      })
      .from(activityLog)
      .where(and(eq(activityLog.orderId, id), eq(activityLog.action, action)))
      .orderBy(asc(activityLog.id));
  return { admin, orderId: id, order: await read(), read, token, send, events };
}

describe("orderStatus.change", () => {
  dbTest(
    "lets Staff move an Order forward, logging from, to, source and note",
    async (tx) => {
      const { orderId, read, token, events } = await seed(tx);
      const staff = await seedActor(tx, "staff");

      expect(
        await orderStatus.change(
          staff,
          orderId,
          {
            to: "delivered",
            note: "Delivered by hand",
            updatedAt: await token(),
          },
          { executor: tx },
        ),
      ).toEqual({ status: "delivered" });
      expect(await read()).toMatchObject({ status: "delivered" });
      expect(await events("status_change")).toEqual([
        {
          entityType: "orders",
          entityLabel: (await read()).orderNo,
          userName: "Test staff",
          details: {
            from: "created",
            to: "delivered",
            source: "manual",
            note: "Delivered by hand",
          },
        },
      ]);
    },
  );

  dbTest(
    "stops Staff moving back, to Completed or to Cancelled",
    async (tx) => {
      const { admin, orderId, read, token } = await seed(tx);
      const staff = await seedActor(tx, "staff");
      const change = async (actor: CurrentUser, to: string) =>
        orderStatus.change(
          actor,
          orderId,
          { to, updatedAt: await token() },
          { executor: tx },
        );
      await change(admin, "delivered");

      for (const to of ["created", "completed"])
        await expect(inSavepoint(tx, () => change(staff, to))).rejects.toThrow(
          NotAllowedError,
        );
      await expect(
        inSavepoint(tx, () => change(admin, "cancelled")),
      ).rejects.toThrow(UserInputError);
      expect(await read()).toMatchObject({ status: "delivered" });
    },
  );

  dbTest(
    "lets a Manager move an Order back and mark it Completed, which locks it",
    async (tx) => {
      const { orderId, read, token, events } = await seed(tx);
      const manager = await seedActor(tx, "manager");
      const change = async (to: string) =>
        orderStatus.change(
          manager,
          orderId,
          { to, updatedAt: await token() },
          { executor: tx },
        );

      await change("delivered");
      await change("wo_sent");
      expect(await read()).toMatchObject({
        status: "wo_sent",
        isLocked: false,
      });

      await change("completed");
      const order = await read();
      expect(order).toMatchObject({ status: "completed", isLocked: true });
      expect(order.completedAt).toBeInstanceOf(Date);
      expect(await events("lock")).toHaveLength(1);

      // Moving back keeps the lock: only an Admin unlocks (SPEC §3).
      await change("invoiced");
      expect(await read()).toMatchObject({
        status: "invoiced",
        isLocked: true,
        completedAt: null,
      });
    },
  );

  dbTest("refuses a change made on a stale page", async (tx) => {
    const { admin, orderId, order, read } = await seed(tx);
    const stale = order.updatedAt?.toISOString() ?? null;
    await orderStatus.change(
      admin,
      orderId,
      { to: "delivered", updatedAt: stale },
      { executor: tx },
    );
    await expect(
      inSavepoint(tx, () =>
        orderStatus.change(
          admin,
          orderId,
          { to: "invoiced", updatedAt: stale },
          { executor: tx },
        ),
      ),
    ).rejects.toThrow(/This order was changed by/);
    expect(await read()).toMatchObject({ status: "delivered" });
  });
});

describe("orderStatus.cancel and restore", () => {
  dbTest(
    "cancels with a reason, cancelling sent Work Orders, and restores the previous status",
    async (tx) => {
      const { orderId, order, read, token, send, events } = await seed(tx);
      const manager = await seedActor(tx, "manager");
      const [woA, woB] = order.workOrders;
      await send(manager, { type: "work_order", workOrderId: woA!.id });
      await send(manager, { type: "challan" });

      expect(
        await orderStatus.cancel(
          manager,
          orderId,
          { reason: "Customer called it off", updatedAt: await token() },
          { executor: tx },
        ),
      ).toEqual({ status: "cancelled" });
      let after = await read();
      expect(after).toMatchObject({
        status: "cancelled",
        statusBeforeCancel: "delivered",
        cancelReason: "Customer called it off",
      });
      expect(after.cancelledAt).toBeInstanceOf(Date);
      // The sent one is cancelled; the pending one stays, with its lines.
      expect(after.workOrders.map((wo) => [wo.id, wo.status])).toEqual([
        [woA!.id, "cancelled"],
        [woB!.id, "pending"],
      ]);
      expect(await events("cancel")).toMatchObject([
        {
          details: {
            from: "delivered",
            to: "cancelled",
            source: "manual",
            reason: "Customer called it off",
          },
        },
      ]);

      expect(
        await orderStatus.restore(
          manager,
          orderId,
          { updatedAt: await token() },
          { executor: tx },
        ),
      ).toEqual({ status: "delivered" });
      after = await read();
      expect(after).toMatchObject({
        status: "delivered",
        statusBeforeCancel: null,
        cancelReason: null,
        cancelledAt: null,
      });
      expect(after.workOrders.map((wo) => wo.status)).toEqual([
        "sent",
        "pending",
      ]);
      expect(await events("restore")).toMatchObject([
        { details: { from: "cancelled", to: "delivered", source: "manual" } },
      ]);
      // Each Work Order's move is in the history too.
      expect(
        (await events("status_change")).filter(
          (event) => event.entityType === "work_orders",
        ),
      ).toMatchObject([
        { details: { from: "pending", to: "sent" } },
        { details: { from: "sent", to: "cancelled", source: "manual" } },
        { details: { from: "cancelled", to: "sent", source: "manual" } },
      ]);
    },
  );

  dbTest(
    "keeps Staff out, wants a reason, and won't cancel twice or restore an open Order",
    async (tx) => {
      const { admin, orderId, read, token } = await seed(tx);
      const staff = await seedActor(tx, "staff");
      const cancel = async (actor: CurrentUser, reason: string) =>
        orderStatus.cancel(
          actor,
          orderId,
          { reason, updatedAt: await token() },
          { executor: tx },
        );
      const restore = async (actor: CurrentUser) =>
        orderStatus.restore(
          actor,
          orderId,
          { updatedAt: await token() },
          { executor: tx },
        );

      await expect(
        inSavepoint(tx, () => cancel(staff, "No longer needed")),
      ).rejects.toThrow(NotAllowedError);
      await expect(inSavepoint(tx, () => cancel(admin, "  "))).rejects.toThrow(
        new UserInputError("Enter a reason for cancelling."),
      );
      await expect(inSavepoint(tx, () => restore(admin))).rejects.toThrow(
        UserInputError,
      );

      await cancel(admin, "Duplicate order");
      await expect(
        inSavepoint(tx, () => cancel(admin, "Again")),
      ).rejects.toThrow(UserInputError);
      await expect(inSavepoint(tx, () => restore(staff))).rejects.toThrow(
        NotAllowedError,
      );
      await expect(
        inSavepoint(tx, async () =>
          orderStatus.change(
            admin,
            orderId,
            { to: "created", updatedAt: await token() },
            { executor: tx },
          ),
        ),
      ).rejects.toThrow(UserInputError);
      expect(await read()).toMatchObject({ status: "cancelled" });
    },
  );
});

describe("orderStatus.unlock", () => {
  dbTest(
    "lets only an Admin unlock, with a reason, and sending the Invoice again re-locks",
    async (tx) => {
      const { admin, orderId, read, token, send, events } = await seed(tx);
      const manager = await seedActor(tx, "manager");
      const unlock = async (actor: CurrentUser, reason: string) =>
        orderStatus.unlock(
          actor,
          orderId,
          { reason, updatedAt: await token() },
          { executor: tx },
        );

      await expect(
        inSavepoint(tx, () => unlock(admin, "Fix a price")),
      ).rejects.toThrow(new UserInputError("This order isn't locked."));
      await send(manager, { type: "invoice" });
      expect(await read()).toMatchObject({
        status: "invoiced",
        isLocked: true,
      });

      await expect(
        inSavepoint(tx, () => unlock(manager, "Fix a price")),
      ).rejects.toThrow(NotAllowedError);
      await expect(inSavepoint(tx, () => unlock(admin, ""))).rejects.toThrow(
        new UserInputError("Enter a reason for unlocking."),
      );

      expect(await unlock(admin, "Wrong quantity on the Invoice")).toEqual({
        status: "invoiced",
      });
      expect(await read()).toMatchObject({
        status: "invoiced",
        isLocked: false,
      });
      expect(await events("unlock")).toMatchObject([
        {
          userName: "Test admin",
          details: {
            from: "invoiced",
            to: "invoiced",
            source: "manual",
            reason: "Wrong quantity on the Invoice",
          },
        },
      ]);

      // Unlocked, its dates move again; the Invoice locks it once more.
      await documents.send(
        manager,
        orderId,
        { type: "invoice" },
        { date: "2026-10-23", via: "share" },
        { executor: tx, storage },
      );
      expect(await read()).toMatchObject({
        isLocked: true,
        invoiceDate: "2026-10-23",
      });
      expect(await events("lock")).toHaveLength(2);
    },
  );
});
