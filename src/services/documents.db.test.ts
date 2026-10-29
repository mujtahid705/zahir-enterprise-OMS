import { and, asc, count, eq } from "drizzle-orm";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import {
  activityLog,
  orders as ordersTable,
  profiles,
  workOrders,
} from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { asSystem } from "@/db/test/fixtures";
import { dbTest, inSavepoint } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { UserInputError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import {
  replaceCompanyImage,
  updateCompanyDetails,
  type AssetStorage,
} from "@/services/company-settings";
import { documents } from "@/services/documents";
import { orders } from "@/services/orders";
import { customers, suppliers } from "@/services/parties";
import { products } from "@/services/products";

// Stands in for the company-assets bucket.
function fakeStorage(): AssetStorage {
  const files = new Map<
    string,
    { bytes: Uint8Array<ArrayBuffer>; contentType: string }
  >();
  return {
    async upload(path, bytes, contentType) {
      files.set(path, { bytes, contentType });
    },
    async download(path) {
      return files.get(path) ?? null;
    },
    async remove(path) {
      files.delete(path);
    },
  };
}

async function seedActor(tx: Tx, role: Role): Promise<CurrentUser> {
  const actor = await seedUser(tx, { fullName: `Test ${role}`, role });
  const [profile] = await tx
    .select()
    .from(profiles)
    .where(eq(profiles.id, actor.id));
  return { id: actor.id, name: actor.name, email: profile!.email, role };
}

// An Admin sets up the letterhead and a one-line Order for Highway Sweets.
async function seed(tx: Tx, storage: AssetStorage) {
  const admin = await seedActor(tx, "admin");
  const executor = { executor: tx };
  await updateCompanyDetails(
    admin,
    {
      name: "Zahir Enterprise Test",
      address: "House 7, Road 3, Dhanmondi, Dhaka",
      phone: "01700000000",
      email: "info@ze.test",
      paymentInstructions: "bKash 01799999999",
      defaultWoNote: "",
    },
    executor,
  );
  const signature = await sharp({
    create: {
      width: 8,
      height: 4,
      channels: 4,
      background: { r: 8, g: 31, b: 63, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  await replaceCompanyImage(admin, "signature", new Uint8Array(signature), {
    ...executor,
    storage,
  });
  const customer = await customers.create(
    admin,
    { name: "Highway Sweets", phone: "01711000000", address: "Dhaka" },
    executor,
  );
  const supplier = await suppliers.create(
    admin,
    {
      name: "Suzinas",
      phone: "01811000000",
      whatsapp: "01811000000",
      address: "Tongi",
    },
    executor,
  );
  const product = await products.create(
    admin,
    {
      customerId: customer.id,
      supplierId: supplier.id,
      name: "Bread poly packet",
      sellPrice: "2.50",
      buyPrice: "2.00",
    },
    executor,
  );
  const { id } = await orders.create(
    admin,
    {
      customerId: customer.id,
      orderDate: "2026-10-20",
      items: [{ productId: product.id, quantity: 5000 }],
    },
    executor,
  );
  const order = await orders.get(admin, id, executor);
  return { orderId: id, order: order! };
}

async function textOf(pdf: Buffer) {
  const proxy = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(proxy, { mergePages: true });
  return text.replace(/\s+/g, " ");
}

describe("documents.render", () => {
  dbTest(
    "renders each document for Staff with ZE's letterhead, changing and logging nothing",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, order } = await seed(tx, storage);
      const staff = await seedActor(tx, "staff");
      const logged = async () =>
        (
          await tx
            .select({ n: count() })
            .from(activityLog)
            .where(eq(activityLog.orderId, orderId))
        )[0]!.n;
      const before = await logged();
      const deps = { executor: tx, storage };
      const [wo] = order.workOrders;

      const workOrder = await documents.render(
        staff,
        orderId,
        { type: "work_order", workOrderId: wo!.id },
        deps,
      );
      expect(workOrder?.fileName).toBe(`${wo!.woNo}_Suzinas.pdf`);
      const woText = await textOf(workOrder!.pdf);
      expect(woText).toContain("Zahir Enterprise Test");
      expect(woText).toContain("Tk 2.00");
      expect(woText).not.toContain("Highway Sweets");

      const invoice = await documents.render(
        staff,
        orderId,
        { type: "invoice" },
        { ...deps, date: "2026-10-25" },
      );
      expect(invoice?.fileName).toBe(`${order.invoiceNo}_Highway-Sweets.pdf`);
      const invoiceText = await textOf(invoice!.pdf);
      expect(invoiceText).toContain("25 Oct 2026");
      expect(invoiceText).toContain("bKash 01799999999");

      const challan = await documents.render(
        staff,
        orderId,
        { type: "challan" },
        deps,
      );
      expect(challan?.fileName).toBe(`${order.challanNo}_Highway-Sweets.pdf`);

      expect(await logged()).toBe(before);
      const after = await orders.get(staff, orderId, { executor: tx });
      expect(after).toMatchObject({
        status: "created",
        challanDate: null,
        invoiceDate: null,
      });
      expect(after!.workOrders[0]).toMatchObject({
        status: "pending",
        woDate: null,
      });
    },
  );

  dbTest("finds nothing for a Work Order of another Order", async (tx) => {
    const storage = fakeStorage();
    const { orderId } = await seed(tx, storage);
    const staff = await seedActor(tx, "staff");
    expect(
      await documents.render(
        staff,
        orderId,
        {
          type: "work_order",
          workOrderId: "00000000-0000-4000-8000-000000000000",
        },
        { executor: tx, storage },
      ),
    ).toBeUndefined();
  });
});

// SPEC §5.4: bread packets from Suzinas, carry bags from Rahim Plastics, so
// the Order has two Work Orders. No letterhead images: the default logo
// prints.
async function seedTwoSuppliers(tx: Tx) {
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
  const order = (await orders.get(admin, id, executor))!;
  const [a, b] = order.workOrders;
  return {
    orderId: id,
    order,
    woA: { type: "work_order", workOrderId: a!.id } as const,
    woB: { type: "work_order", workOrderId: b!.id } as const,
  };
}

describe("documents.send", () => {
  dbTest(
    "marks each Work Order sent, and the Order WO Sent once all are",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, woA, woB } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const read = () => orders.get(staff, orderId, { executor: tx });

      await documents.send(
        staff,
        orderId,
        woA,
        { date: "2026-10-21", via: "download" },
        deps,
      );
      let order = await read();
      expect(order).toMatchObject({ status: "created" });
      expect(order!.workOrders.map((wo) => wo.status)).toEqual([
        "sent",
        "pending",
      ]);
      expect(order!.workOrders[0]).toMatchObject({ woDate: "2026-10-21" });
      expect(order!.workOrders[0]!.sentAt).toBeInstanceOf(Date);

      await documents.send(
        staff,
        orderId,
        woB,
        { date: "2026-10-21", via: "share" },
        deps,
      );
      order = await read();
      expect(order).toMatchObject({ status: "wo_sent" });
      expect(order!.workOrders.map((wo) => wo.status)).toEqual([
        "sent",
        "sent",
      ]);
    },
  );

  dbTest(
    "moves the Order to Delivered on the Challan and Invoiced on the Invoice, which locks it",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, woA, woB } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const send = (ref: Parameters<typeof documents.send>[2]) =>
        documents.send(
          staff,
          orderId,
          ref,
          { date: "2026-10-22", via: "share" },
          deps,
        );
      const read = () => orders.get(staff, orderId, { executor: tx });

      await send(woA);
      await send(woB);
      await send({ type: "challan" });
      expect(await read()).toMatchObject({
        status: "delivered",
        challanDate: "2026-10-22",
        isLocked: false,
      });
      expect((await read())!.challanDownloadedAt).toBeInstanceOf(Date);

      expect(await send({ type: "invoice" })).toMatchObject({
        status: "invoiced",
      });
      const order = await read();
      expect(order).toMatchObject({
        status: "invoiced",
        invoiceDate: "2026-10-22",
        isLocked: true,
      });
      expect(order!.invoiceDownloadedAt).toBeInstanceOf(Date);
    },
  );

  dbTest(
    "sends the Challan before every Work Order is sent, leaving those pending",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      await documents.send(
        staff,
        orderId,
        { type: "challan" },
        { date: "2026-10-22", via: "download" },
        { executor: tx, storage },
      );
      const order = await orders.get(staff, orderId, { executor: tx });
      expect(order).toMatchObject({ status: "delivered" });
      expect(order!.workOrders.map((wo) => wo.status)).toEqual([
        "pending",
        "pending",
      ]);
    },
  );

  dbTest(
    "never moves the status back when an older document is sent again",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, woA, woB } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const today = todayInDhaka();
      const send = (ref: Parameters<typeof documents.send>[2]) =>
        documents.send(
          staff,
          orderId,
          ref,
          { date: today, via: "download" },
          deps,
        );

      await send({ type: "invoice" });
      expect(await send(woA)).toMatchObject({ status: "invoiced" });
      expect(await send(woB)).toMatchObject({ status: "invoiced" });
      expect(await send({ type: "challan" })).toMatchObject({
        status: "invoiced",
      });
      expect(await send({ type: "invoice" })).toMatchObject({
        status: "invoiced",
      });
      expect(await orders.get(staff, orderId, { executor: tx })).toMatchObject({
        status: "invoiced",
        isLocked: true,
      });
    },
  );

  dbTest(
    "re-sending a Work Order clears Needs re-send and keeps the first sent time",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, woA } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const sendA = () =>
        documents.send(
          staff,
          orderId,
          woA,
          { date: "2026-10-21", via: "download" },
          deps,
        );
      await sendA();
      const first = (await orders.get(staff, orderId, { executor: tx }))!
        .workOrders[0]!.sentAt;
      // An edit after sending (issue #15) flags the WO and the Challan.
      await asSystem(tx, async () => {
        await tx
          .update(workOrders)
          .set({ needsResend: true })
          .where(eq(workOrders.id, woA.workOrderId));
        await tx
          .update(ordersTable)
          .set({ challanNeedsResend: true })
          .where(eq(ordersTable.id, orderId));
      });

      await sendA();
      await documents.send(
        staff,
        orderId,
        { type: "challan" },
        { date: "2026-10-21", via: "share" },
        deps,
      );
      const order = await orders.get(staff, orderId, { executor: tx });
      expect(order!.workOrders[0]).toMatchObject({
        status: "sent",
        needsResend: false,
        sentAt: first,
      });
      expect(order).toMatchObject({ challanNeedsResend: false });
    },
  );

  dbTest(
    "hands back the PDF on a Download and nothing on a Share",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, order, woA } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const downloaded = await documents.send(
        staff,
        orderId,
        woA,
        { date: "2026-10-21", via: "download" },
        deps,
      );
      expect(downloaded?.file?.fileName).toBe(
        `${order.workOrders[0]!.woNo}_Suzinas.pdf`,
      );
      expect(await textOf(downloaded!.file!.pdf)).toContain("21 Oct 2026");

      const shared = await documents.send(
        staff,
        orderId,
        { type: "challan" },
        { date: "2026-10-21", via: "share" },
        deps,
      );
      expect(shared?.file).toBeUndefined();
    },
  );

  dbTest(
    "logs the send, the date change, each status change and the lock against the Order",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, order, woA, woB } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const [a] = order.workOrders;

      await documents.send(
        staff,
        orderId,
        woA,
        { date: "2026-10-21", via: "download" },
        deps,
      );
      await documents.send(
        staff,
        orderId,
        woA,
        { date: "2026-10-22", via: "share" },
        deps,
      );
      await documents.send(
        staff,
        orderId,
        woB,
        { date: "2026-10-22", via: "share" },
        deps,
      );
      await documents.send(
        staff,
        orderId,
        { type: "invoice" },
        { date: "2026-10-23", via: "download" },
        deps,
      );

      const events = await tx
        .select({
          action: activityLog.action,
          userName: activityLog.userName,
          entityLabel: activityLog.entityLabel,
          details: activityLog.details,
        })
        .from(activityLog)
        .where(
          and(eq(activityLog.orderId, orderId), eq(activityLog.kind, "event")),
        )
        .orderBy(asc(activityLog.id));
      const woEvent = { document: "work_order", work_order_id: a!.id };
      expect(events.slice(0, 5)).toEqual([
        {
          action: "document_download",
          userName: "Test staff",
          entityLabel: a!.woNo,
          details: { ...woEvent, date: "2026-10-21" },
        },
        {
          action: "status_change",
          userName: "Test staff",
          entityLabel: a!.woNo,
          details: { ...woEvent, from: "pending", to: "sent", source: "auto" },
        },
        {
          action: "document_date_change",
          userName: "Test staff",
          entityLabel: a!.woNo,
          details: { ...woEvent, from: "2026-10-21", to: "2026-10-22" },
        },
        {
          action: "document_share",
          userName: "Test staff",
          entityLabel: a!.woNo,
          details: { ...woEvent, date: "2026-10-22" },
        },
        expect.objectContaining({ action: "document_share" }),
      ]);
      expect(events.slice(5).map((event) => event.action)).toEqual([
        "status_change",
        "status_change",
        "document_download",
        "status_change",
        "lock",
      ]);
      expect(events[6]).toMatchObject({
        entityLabel: order.orderNo,
        details: { from: "created", to: "wo_sent", source: "auto" },
      });
      expect(events.at(-2)).toMatchObject({
        entityLabel: order.orderNo,
        details: { document: "invoice", from: "wo_sent", to: "invoiced" },
      });
    },
  );

  dbTest(
    "keeps document dates locked with the Order, but still lets it be sent",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, woA } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      const deps = { executor: tx, storage };
      const today = todayInDhaka();
      await documents.send(
        staff,
        orderId,
        { type: "invoice" },
        { date: "2026-10-23", via: "download" },
        deps,
      );

      await expect(
        inSavepoint(tx, (sp) =>
          documents.send(
            staff,
            orderId,
            { type: "invoice" },
            { date: "2026-10-24", via: "download" },
            { executor: sp, storage },
          ),
        ),
      ).rejects.toThrow(new UserInputError("Dates are locked with the order."));
      // A WO never sent before the lock goes out dated today.
      await expect(
        inSavepoint(tx, (sp) =>
          documents.send(
            staff,
            orderId,
            woA,
            { date: "2026-10-01", via: "download" },
            { executor: sp, storage },
          ),
        ),
      ).rejects.toThrow(UserInputError);

      await documents.send(
        staff,
        orderId,
        { type: "invoice" },
        { date: "2026-10-23", via: "share" },
        deps,
      );
      await documents.send(
        staff,
        orderId,
        woA,
        { date: today, via: "share" },
        deps,
      );
      const order = await orders.get(staff, orderId, { executor: tx });
      expect(order).toMatchObject({ invoiceDate: "2026-10-23" });
      expect(order!.workOrders[0]).toMatchObject({ woDate: today });
    },
  );

  dbTest("refuses to send for a cancelled Order", async (tx) => {
    const storage = fakeStorage();
    const { orderId } = await seedTwoSuppliers(tx);
    const staff = await seedActor(tx, "staff");
    await asSystem(tx, () =>
      tx
        .update(ordersTable)
        .set({ status: "cancelled" })
        .where(eq(ordersTable.id, orderId)),
    );
    await expect(
      inSavepoint(tx, (sp) =>
        documents.send(
          staff,
          orderId,
          { type: "challan" },
          { date: "2026-10-22", via: "share" },
          { executor: sp, storage },
        ),
      ),
    ).rejects.toThrow(UserInputError);
  });

  dbTest("finds nothing for a Work Order of another Order", async (tx) => {
    const storage = fakeStorage();
    const { orderId } = await seedTwoSuppliers(tx);
    const staff = await seedActor(tx, "staff");
    expect(
      await documents.send(
        staff,
        orderId,
        {
          type: "work_order",
          workOrderId: "00000000-0000-4000-8000-000000000000",
        },
        { date: "2026-10-22", via: "share" },
        { executor: tx, storage },
      ),
    ).toBeUndefined();
  });

  dbTest(
    "lists the Order's status and document events for every role, newest first",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, order } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      await documents.send(
        staff,
        orderId,
        { type: "challan" },
        { date: "2026-10-22", via: "share" },
        { executor: tx, storage },
      );

      const history = await orders.history(staff, orderId, { executor: tx });
      expect(history.map((entry) => entry.action)).toEqual([
        "status_change",
        "document_share",
      ]);
      expect(history[0]).toMatchObject({
        userName: "Test staff",
        entityType: "orders",
        entityLabel: order.orderNo,
        details: { from: "created", to: "delivered", source: "auto" },
      });
      expect(history[0]!.occurredAt).toBeInstanceOf(Date);
    },
  );

  dbTest(
    "leaves cancelled Work Orders out of WO Sent, and refuses to send one",
    async (tx) => {
      const storage = fakeStorage();
      const { orderId, woA, woB } = await seedTwoSuppliers(tx);
      const staff = await seedActor(tx, "staff");
      // An edit after sending (issue #15) cancelled Rahim's WO.
      await asSystem(tx, () =>
        tx
          .update(workOrders)
          .set({ status: "cancelled" })
          .where(eq(workOrders.id, woB.workOrderId)),
      );
      await expect(
        inSavepoint(tx, (sp) =>
          documents.send(
            staff,
            orderId,
            woB,
            { date: "2026-10-21", via: "share" },
            { executor: sp, storage },
          ),
        ),
      ).rejects.toThrow(UserInputError);

      expect(
        await documents.send(
          staff,
          orderId,
          woA,
          { date: "2026-10-21", via: "share" },
          { executor: tx, storage },
        ),
      ).toMatchObject({ status: "wo_sent" });
    },
  );
});
