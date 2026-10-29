import { describe, expect, it } from "vitest";
import { buildDocument } from "@/lib/documents";
import { highwaySweetsOrder } from "@/lib/documents.fixture";

const TODAY = "2026-10-27";

describe("buildDocument", () => {
  it("makes a supplier's Work Order from its own lines at Buy prices", () => {
    const built = buildDocument(
      highwaySweetsOrder,
      { type: "work_order", workOrderId: "wo-a" },
      { today: TODAY },
    );
    expect(built?.fileName).toBe("WO-2026-0012-A_Suzinas.pdf");
    expect(built?.document).toMatchObject({
      type: "work_order",
      number: "WO-2026-0012-A",
      date: "2026-10-21",
      requiredBy: "2026-10-30",
      to: {
        name: "Suzinas",
        address: "Plot 4, Tongi BSCIC",
        phone: "01811000000",
      },
      lines: [
        { productName: "Bread poly packet", price: "2.00", total: "10000.00" },
        { productName: "Sweet box 1 kg", price: "6.00", total: "6000.00" },
      ],
      totalQuantity: 6000,
      total: "16000.00",
      note: "Deliver in cartons of 500.",
    });
  });

  it("makes the Challan to the delivery address with no prices", () => {
    const built = buildDocument(
      highwaySweetsOrder,
      { type: "challan" },
      { today: TODAY },
    );
    expect(built?.fileName).toBe("CH-2026-0012_Highway-Sweets.pdf");
    expect(built?.document).toEqual({
      type: "challan",
      number: "CH-2026-0012",
      date: TODAY,
      orderNo: "ORD-2026-0012",
      customerRef: "PO-77",
      to: {
        name: "Highway Sweets",
        address: "Shop 3, New Market, Dhaka",
        phone: "01711000000",
      },
      lines: [
        {
          productName: "Bread poly packet",
          specText: "10×14 in / 40 micron",
          quantity: 5000,
        },
        { productName: "Carry bag large", specText: "", quantity: 2000 },
        { productName: "Sweet box 1 kg", specText: "", quantity: 1000 },
      ],
      totalQuantity: 8000,
    });
  });

  it("makes the Invoice at Sell prices with the grand total", () => {
    const built = buildDocument(
      highwaySweetsOrder,
      { type: "invoice" },
      { today: TODAY },
    );
    expect(built?.fileName).toBe("INV-2026-0012_Highway-Sweets.pdf");
    expect(built?.document).toMatchObject({
      type: "invoice",
      number: "INV-2026-0012",
      date: "2026-10-25",
      orderNo: "ORD-2026-0012",
      challanNo: "CH-2026-0012",
      customerRef: "PO-77",
      to: { name: "Highway Sweets", address: "12 Station Road, Dhaka" },
      lines: [
        { price: "2.50", total: "12500.00" },
        { price: "4.00", total: "8000.00" },
        { price: "8.00", total: "8000.00" },
      ],
      totalQuantity: 8000,
      total: "28500.00",
      note: "Thank you for your business.",
    });
  });

  it("dates a document by the date asked for, else its stored date, else today", () => {
    const wo = { type: "work_order", workOrderId: "wo-a" } as const;
    const dateOf = (date?: string) =>
      buildDocument(highwaySweetsOrder, wo, { today: TODAY, date })?.document
        .date;
    expect(dateOf("2026-11-01")).toBe("2026-11-01");
    expect(dateOf()).toBe("2026-10-21");
    expect(
      buildDocument(
        highwaySweetsOrder,
        { type: "work_order", workOrderId: "wo-b" },
        { today: TODAY },
      )?.document.date,
    ).toBe(TODAY);
  });

  it("finds no Work Order that isn't on the Order", () => {
    expect(
      buildDocument(
        highwaySweetsOrder,
        { type: "work_order", workOrderId: "elsewhere" },
        { today: TODAY },
      ),
    ).toBeUndefined();
  });

  it("keeps file names to letters, digits and hyphens", () => {
    const order = {
      ...highwaySweetsOrder,
      customerName: "  M/s. Karim & Sons (Pvt) ",
    };
    expect(
      buildDocument(order, { type: "challan" }, { today: TODAY })?.fileName,
    ).toBe("CH-2026-0012_Ms-Karim-Sons-Pvt.pdf");
  });
});
