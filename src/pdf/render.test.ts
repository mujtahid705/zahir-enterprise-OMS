import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import { buildDocument, type DocumentRef } from "@/lib/documents";
import { highwaySweetsOrder } from "@/lib/documents.fixture";
import { defaultLogo, type Letterhead } from "@/pdf/letterhead";
import { renderDocumentPdf } from "@/pdf/render";

// Smoke tests (SPEC §8): each document renders as a PDF whose text carries
// what its recipient should see and nothing they shouldn't.

let letterhead: Letterhead;

beforeAll(async () => {
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
  letterhead = {
    name: "Zahir Enterprise",
    address: "House 7, Road 3, Dhanmondi, Dhaka",
    phone: "01700000000",
    email: "info@ze.test",
    logo: await defaultLogo(),
    signature: { data: signature, format: "png" },
    paymentInstructions: "bKash 01700000000",
  };
});

async function textOf(ref: DocumentRef, order = highwaySweetsOrder) {
  const built = buildDocument(order, ref, { today: "2026-10-27" })!;
  const pdf = await renderDocumentPdf(built.document, letterhead);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const proxy = await getDocumentProxy(new Uint8Array(pdf));
  const { totalPages, text } = await extractText(proxy, { mergePages: true });
  // Letter-spaced titles come out as "I N V O I C E", so they are checked
  // with the whitespace taken out.
  return {
    totalPages,
    text: text.replace(/\s+/g, " "),
    letters: text.replace(/\s+/g, ""),
  };
}

describe("renderDocumentPdf", () => {
  it("prints a Work Order with Buy prices, never the Customer or Sell prices", async () => {
    const { text, letters, totalPages } = await textOf({
      type: "work_order",
      workOrderId: "wo-a",
    });
    expect(totalPages).toBe(1);
    expect(letters).toContain("WORKORDER");
    for (const shown of [
      "Zahir Enterprise",
      "House 7, Road 3, Dhanmondi, Dhaka",
      "info@ze.test",
      "WO-2026-0012-A",
      "21 Oct 2026",
      "30 Oct 2026",
      "Suzinas",
      "Plot 4, Tongi BSCIC",
      "Bread poly packet",
      "10×14 in / 40 micron",
      "Tk 2.00",
      "Tk 10,000.00",
      "6,000 pcs",
      "Tk 16,000.00",
      "Taka Sixteen Thousand Only",
      "Deliver in cartons of 500.",
      "Authorised signature",
    ]) {
      expect(text).toContain(shown);
    }
    for (const hidden of [
      "Highway Sweets",
      "Tk 2.50",
      "Tk 12,500.00",
      "Carry bag large",
      "bKash",
      "Page 1",
    ]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("prints the Challan with quantities only, no prices or Suppliers", async () => {
    const { text, letters } = await textOf({ type: "challan" });
    expect(letters).toContain("DELIVERYCHALLAN");
    for (const shown of [
      "CH-2026-0012",
      "ORD-2026-0012",
      "PO-77",
      "27 Oct 2026",
      "Highway Sweets",
      "Shop 3, New Market, Dhaka",
      "Carry bag large",
      "8,000 pcs",
      "Received by",
      "Delivered by",
    ]) {
      expect(text).toContain(shown);
    }
    for (const hidden of ["Tk", "Taka", "Suzinas", "Rahim Plastics"]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("prints the Invoice with Sell prices, never Buy prices or Suppliers", async () => {
    const { text, letters } = await textOf({ type: "invoice" });
    expect(letters).toContain("INVOICE");
    for (const shown of [
      "INV-2026-0012",
      "CH-2026-0012",
      "25 Oct 2026",
      "12 Station Road, Dhaka",
      "Tk 2.50",
      "Tk 12,500.00",
      "Tk 28,500.00",
      "Taka Twenty-Eight Thousand Five Hundred Only",
      "Thank you for your business.",
      "bKash 01700000000",
    ]) {
      expect(text).toContain(shown);
    }
    for (const hidden of [
      "Tk 2.00",
      "Tk 22,000.00",
      "Tk 6,500.00",
      "Suzinas",
      "Rahim Plastics",
    ]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("numbers the pages of a document that runs past one page", async () => {
    const item = highwaySweetsOrder.items[1]!;
    const order = {
      ...highwaySweetsOrder,
      items: Array.from({ length: 30 }, (_, i) => ({
        ...item,
        productName: `Carry bag ${i + 1}`,
      })),
    };
    const { text, totalPages } = await textOf({ type: "invoice" }, order);
    expect(totalPages).toBe(2);
    expect(text).toContain("Page 1 of 2");
    expect(text).toContain("Page 2 of 2");
  });
});
