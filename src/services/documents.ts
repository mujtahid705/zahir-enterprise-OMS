import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Db, type Tx } from "@/db/client";
import { orders as ordersTable, workOrders } from "@/db/schema";
import { withUser } from "@/db/with-user";
import { logEvent } from "@/lib/activity";
import type { CurrentUser } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { buildDocument, type DocumentRef } from "@/lib/documents";
import { UserInputError } from "@/lib/errors";
import type { OrderStatus } from "@/lib/orders";
import { forward } from "@/lib/sending";
import { defaultLogo, printableImage, type Letterhead } from "@/pdf/letterhead";
import { renderDocumentPdf } from "@/pdf/render";
import {
  getLetterheadSettings,
  type AssetStorage,
} from "@/services/company-settings";
import { authorize, parse } from "@/services/master-data";
import { orders } from "@/services/orders";

// An Order's Work Orders, Challan and Invoice as PDFs (SPEC §8). Rendering
// alone changes nothing and logs nothing: it serves Preview and the file
// Share sends (SPEC §13.2 GET). Sending records the Download or completed
// Share and moves the Order on (SPEC §13.2 POST).

type Deps = { executor?: Db | Tx; storage: AssetStorage };

// Company settings with their images ready to print (SPEC §12).
async function letterhead(
  executor: Db | Tx,
  storage: AssetStorage,
): Promise<Letterhead> {
  const settings = await getLetterheadSettings({ executor });
  const image = async (path: string | null | undefined) => {
    const file = path ? await storage.download(path) : null;
    return file ? printableImage(file.bytes, file.contentType) : null;
  };
  const [logo, signature] = await Promise.all([
    image(settings?.logoPath),
    image(settings?.signaturePath),
  ]);
  return {
    name: settings?.name ?? "Zahir Enterprise",
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    logo: logo ?? (await defaultLogo()),
    signature,
    paymentInstructions: settings?.paymentInstructions ?? null,
  };
}

// The PDF and its file name, or undefined if the Order (or the Work Order
// on it) doesn't exist. `date` overrides the document's stored date.
async function render(
  actor: CurrentUser,
  orderId: string,
  ref: DocumentRef,
  { executor = db, storage, date }: Deps & { date?: string },
): Promise<{ fileName: string; pdf: Buffer } | undefined> {
  authorize(actor, "shareDocuments");
  const order = await orders.get(actor, orderId, { executor });
  if (!order) return undefined;
  const built = buildDocument(order, ref, { today: todayInDhaka(), date });
  if (!built) return undefined;
  const pdf = await renderDocumentPdf(
    built.document,
    await letterhead(executor, storage),
  );
  return { fileName: built.fileName, pdf };
}

export const sendSchema = z.object({
  date: z.iso.date("Enter the document date."),
  via: z.enum(["download", "share"]),
});

// A Download or completed Share, in one transaction (SPEC §6.3, §8.0,
// §13.2 POST): stores the document date, marks it sent, clears Needs
// re-send, moves the status forward only, locks the Order on the Invoice and
// logs each of those. A Download hands back the PDF, rendered in the same
// transaction so a failed render changes nothing. Undefined if the Order (or
// the Work Order on it) doesn't exist.
async function send(
  actor: CurrentUser,
  orderId: string,
  ref: DocumentRef,
  // Straight from the browser; parsed here.
  input: unknown,
  { executor = db, storage }: Deps,
): Promise<
  { status: OrderStatus; file?: { fileName: string; pdf: Buffer } } | undefined
> {
  authorize(actor, "shareDocuments");
  const { date, via } = parse(sendSchema, input);
  return withUser(
    actor,
    async (tx) => {
      // The row lock queues a concurrent send of another WO behind this
      // one, so the last of them sees every other WO sent.
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .for("update");
      if (!order) return undefined;
      const wos = await tx
        .select()
        .from(workOrders)
        .where(eq(workOrders.orderId, orderId));
      const wo =
        ref.type === "work_order"
          ? wos.find((row) => row.id === ref.workOrderId)
          : undefined;
      if (ref.type === "work_order" && !wo) return undefined;
      if (order.status === "cancelled")
        throw new UserInputError(
          "This Order is cancelled, so its documents can't be sent.",
        );
      if (wo?.status === "cancelled")
        throw new UserInputError(`${wo.woNo} is cancelled.`);

      const stored = wo
        ? wo.woDate
        : ref.type === "challan"
          ? order.challanDate
          : order.invoiceDate;
      if (order.isLocked && date !== (stored ?? todayInDhaka()))
        throw new UserInputError("Dates are locked with the order.");

      const file =
        via === "download"
          ? await render(actor, orderId, ref, { executor: tx, storage, date })
          : undefined;

      const firstTime = (column: unknown) => sql`coalesce(${column}, now())`;
      let status: OrderStatus = order.status;
      const changes: Partial<typeof ordersTable.$inferInsert> = {};
      if (wo) {
        await tx
          .update(workOrders)
          .set({
            status: "sent",
            needsResend: false,
            woDate: date,
            sentAt: firstTime(workOrders.sentAt),
            updatedAt: new Date(),
          })
          .where(eq(workOrders.id, wo.id));
        const othersPending = wos.some(
          (other) => other.id !== wo.id && other.status === "pending",
        );
        if (!othersPending) status = forward(status, "wo_sent");
      } else if (ref.type === "challan") {
        Object.assign(changes, {
          challanDate: date,
          challanDownloadedAt: firstTime(ordersTable.challanDownloadedAt),
          challanNeedsResend: false,
        });
        status = forward(status, "delivered");
      } else {
        Object.assign(changes, {
          invoiceDate: date,
          invoiceDownloadedAt: firstTime(ordersTable.invoiceDownloadedAt),
          isLocked: true,
        });
        status = forward(status, "invoiced");
      }
      await tx
        .update(ordersTable)
        .set({
          ...changes,
          status,
          updatedAt: new Date(),
          updatedBy: actor.id,
        })
        .where(eq(ordersTable.id, orderId));

      const user = { id: actor.id, name: actor.name };
      const orderEntity = {
        type: "orders",
        id: order.id,
        label: order.orderNo,
      };
      const document = {
        document: ref.type,
        ...(wo && { work_order_id: wo.id }),
      };
      const event = (
        action: Parameters<typeof logEvent>[0]["action"],
        details: Record<string, unknown>,
        entity = wo
          ? { type: "work_orders", id: wo.id, label: wo.woNo }
          : {
              ...orderEntity,
              label: ref.type === "challan" ? order.challanNo : order.invoiceNo,
            },
      ) =>
        logEvent(
          {
            action,
            user,
            entity,
            orderId,
            details: { ...document, ...details },
          },
          tx,
        );

      if (stored && stored !== date)
        await event("document_date_change", { from: stored, to: date });
      await event(via === "download" ? "document_download" : "document_share", {
        date,
      });
      if (wo?.status === "pending")
        await event("status_change", {
          from: "pending",
          to: "sent",
          source: "auto",
        });
      if (status !== order.status)
        await event(
          "status_change",
          { from: order.status, to: status, source: "auto" },
          orderEntity,
        );
      if (ref.type === "invoice" && !order.isLocked)
        await event("lock", {}, orderEntity);

      return { status, file };
    },
    executor,
  );
}

export const documents = { render, send };
