import { and, eq, exists } from "drizzle-orm";
import { z } from "zod";
import { db, type Db, type Tx } from "@/db/client";
import { orderItems, orders as ordersTable, workOrders } from "@/db/schema";
import { withUser } from "@/db/with-user";
import { logEvent, type EventAction } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth";
import { NotAllowedError, UserInputError } from "@/lib/errors";
import { optional, required } from "@/lib/fields";
import {
  ORDER_STATUSES,
  orderEditSchema,
  statusTargets,
  type OrderStatus,
} from "@/lib/orders";
import { authorize, parse } from "@/services/master-data";
import { assertUnchanged } from "@/services/orders";

// Status changes made by hand (SPEC §6.4): Change status and Mark Completed.
// Each runs in one transaction with its Activity Log event. `updatedAt` is
// the Order as the page loaded it, so a change made on a stale page fails
// like a stale edit (SPEC §5.5).

type Deps = { executor?: Db | Tx };

const token = orderEditSchema.shape.updatedAt;

const changeSchema = z.object({
  to: z.enum(ORDER_STATUSES, "Pick a status."),
  note: optional,
  updatedAt: token,
});

const cancelSchema = z.object({
  reason: required("Enter a reason for cancelling."),
  updatedAt: token,
});

const restoreSchema = z.object({ updatedAt: token });

const unlockSchema = z.object({
  reason: required("Enter a reason for unlocking."),
  updatedAt: token,
});

type Order = typeof ordersTable.$inferSelect;

// Locks the Order's row for the change and checks the page wasn't stale.
// Undefined if the Order doesn't exist.
async function lockOrder(
  tx: Tx,
  id: string,
  updatedAt: string | null,
): Promise<Order | undefined> {
  const [order] = await tx
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .for("update");
  if (!order) return undefined;
  await assertUnchanged(tx, order, updatedAt);
  return order;
}

// Logs a manual event on the Order, or on one of its Work Orders.
function eventFor(actor: CurrentUser, order: Order, tx: Tx) {
  return (
    action: EventAction,
    details: Record<string, unknown>,
    entity = { type: "orders", id: order.id, label: order.orderNo },
  ) =>
    logEvent(
      {
        action,
        user: { id: actor.id, name: actor.name },
        entity,
        orderId: order.id,
        details: { source: "manual", ...details },
      },
      tx,
    );
}

// Invoiced and Completed Orders are locked (SPEC §5.5), however they got
// there. Moving back keeps the lock: only an Admin unlocks.
const LOCKING: readonly OrderStatus[] = ["invoiced", "completed"];

// Moves the Order to `to` (SPEC §6.4): Staff only forward and never to
// Completed; Admins and Managers any way. Cancelling is `cancel`, with its
// reason. Undefined if the Order doesn't exist.
async function change(
  actor: CurrentUser,
  id: string,
  // Straight from the browser; parsed here.
  input: unknown,
  { executor = db }: Deps = {},
): Promise<{ status: OrderStatus } | undefined> {
  authorize(actor, "changeStatusForward");
  const { to, note, updatedAt } = parse(changeSchema, input);
  if (to === "cancelled")
    throw new UserInputError("Cancel the order with a reason instead.");
  return withUser(
    actor,
    async (tx) => {
      const order = await lockOrder(tx, id, updatedAt);
      if (!order) return undefined;
      if (order.status === "cancelled")
        throw new UserInputError("This order is cancelled. Restore it first.");
      if (to === order.status)
        throw new UserInputError("The order already has that status.");
      if (!statusTargets(actor.role, order.status).includes(to))
        throw new NotAllowedError(
          to === "completed" ? "completeOrCancel" : "changeStatusBackward",
        );

      const locks = LOCKING.includes(to) && !order.isLocked;
      await tx
        .update(ordersTable)
        .set({
          status: to,
          completedAt: to === "completed" ? new Date() : null,
          ...(locks && { isLocked: true }),
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(ordersTable.id, id));

      const event = eventFor(actor, order, tx);
      await event("status_change", {
        from: order.status,
        to,
        ...(note && { note }),
      });
      if (locks) await event("lock", { to });
      return { status: to };
    },
    executor,
  );
}

// Cancels the Order with a reason (SPEC §6.1, §6.2), remembering its status
// for Restore. Sent Work Orders become cancelled; pending ones stay as they
// are, still holding their lines, and can't be sent while the Order is
// cancelled. Undefined if the Order doesn't exist.
async function cancel(
  actor: CurrentUser,
  id: string,
  input: unknown,
  { executor = db }: Deps = {},
): Promise<{ status: OrderStatus } | undefined> {
  authorize(actor, "completeOrCancel");
  const { reason, updatedAt } = parse(cancelSchema, input);
  return withUser(
    actor,
    async (tx) => {
      const order = await lockOrder(tx, id, updatedAt);
      if (!order) return undefined;
      if (order.status === "cancelled")
        throw new UserInputError("This order is already cancelled.");

      await tx
        .update(ordersTable)
        .set({
          status: "cancelled",
          statusBeforeCancel: order.status,
          cancelReason: reason,
          cancelledAt: new Date(),
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(ordersTable.id, id));
      const cancelled = await tx
        .update(workOrders)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(workOrders.orderId, id), eq(workOrders.status, "sent")))
        .returning({ id: workOrders.id, woNo: workOrders.woNo });

      const event = eventFor(actor, order, tx);
      await event("cancel", { from: order.status, to: "cancelled", reason });
      for (const wo of cancelled)
        await event(
          "status_change",
          { from: "sent", to: "cancelled" },
          { type: "work_orders", id: wo.id, label: wo.woNo },
        );
      return { status: "cancelled" };
    },
    executor,
  );
}

// Returns a cancelled Order to the status it had (SPEC §5.5, §6.2), its
// lock as it was. The Work Orders cancelled with it are sent again: those
// still holding lines, so one cancelled earlier because its Supplier lost
// every line stays cancelled. Undefined if the Order doesn't exist.
async function restore(
  actor: CurrentUser,
  id: string,
  input: unknown,
  { executor = db }: Deps = {},
): Promise<{ status: OrderStatus } | undefined> {
  authorize(actor, "completeOrCancel");
  const { updatedAt } = parse(restoreSchema, input);
  return withUser(
    actor,
    async (tx) => {
      const order = await lockOrder(tx, id, updatedAt);
      if (!order) return undefined;
      if (order.status !== "cancelled" || !order.statusBeforeCancel)
        throw new UserInputError("Only a cancelled order can be restored.");
      const to = order.statusBeforeCancel;

      await tx
        .update(ordersTable)
        .set({
          status: to,
          statusBeforeCancel: null,
          cancelReason: null,
          cancelledAt: null,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(ordersTable.id, id));
      const holdingLines = tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.workOrderId, workOrders.id));
      const restored = await tx
        .update(workOrders)
        .set({
          status: "sent",
          cancelledAt: null,
          cancelAcknowledgedAt: null,
          cancelAcknowledgedBy: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workOrders.orderId, id),
            eq(workOrders.status, "cancelled"),
            exists(holdingLines),
          ),
        )
        .returning({ id: workOrders.id, woNo: workOrders.woNo });

      const event = eventFor(actor, order, tx);
      await event("restore", { from: "cancelled", to });
      for (const wo of restored)
        await event(
          "status_change",
          { from: "cancelled", to: "sent" },
          { type: "work_orders", id: wo.id, label: wo.woNo },
        );
      return { status: to };
    },
    executor,
  );
}

// Admin's Unlock (SPEC §5.5): the Order keeps its status but may be edited
// and its document dates changed, like an edited sent Order. Sending the
// Invoice again locks it (documents.send). Undefined if the Order doesn't
// exist.
async function unlock(
  actor: CurrentUser,
  id: string,
  input: unknown,
  { executor = db }: Deps = {},
): Promise<{ status: OrderStatus } | undefined> {
  authorize(actor, "unlockOrder");
  const { reason, updatedAt } = parse(unlockSchema, input);
  return withUser(
    actor,
    async (tx) => {
      const order = await lockOrder(tx, id, updatedAt);
      if (!order) return undefined;
      if (order.status === "cancelled")
        throw new UserInputError("This order is cancelled. Restore it first.");
      if (!order.isLocked) throw new UserInputError("This order isn't locked.");

      await tx
        .update(ordersTable)
        .set({ isLocked: false, updatedAt: new Date(), updatedBy: actor.id })
        .where(eq(ordersTable.id, id));
      await eventFor(
        actor,
        order,
        tx,
      )("unlock", {
        from: order.status,
        to: order.status,
        reason,
      });
      return { status: order.status };
    },
    executor,
  );
}

export const orderStatus = { change, cancel, restore, unlock };
