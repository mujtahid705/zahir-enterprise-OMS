import { count, eq } from "drizzle-orm";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect } from "vitest";
import type { Tx } from "@/db/client";
import { activityLog, profiles } from "@/db/schema";
import { createUser as seedUser } from "@/db/test/fixtures";
import { dbTest } from "@/db/test/rollback";
import type { CurrentUser } from "@/lib/auth";
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
