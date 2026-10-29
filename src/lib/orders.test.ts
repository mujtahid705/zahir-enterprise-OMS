import { describe, expect, it } from "vitest";
import {
  editEffects,
  editWarnings,
  lineTotal,
  orderListFilters,
  orderListHref,
  orderTotals,
  specText,
  type PrintedOrder,
  splitWorkOrders,
  woProgress,
} from "@/lib/orders";

describe("splitWorkOrders", () => {
  it("gives each Supplier one Work Order, lettered in order of first appearance", () => {
    const bread = { productId: "bread", supplierId: "suzinas" };
    const bag = { productId: "bag", supplierId: "rahim" };
    const box = { productId: "box", supplierId: "suzinas" };

    expect(splitWorkOrders([bread, bag, box])).toEqual([
      { letter: "A", supplierId: "suzinas", lines: [bread, box] },
      { letter: "B", supplierId: "rahim", lines: [bag] },
    ]);
  });

  it("has no Work Orders without lines", () => {
    expect(splitWorkOrders([])).toEqual([]);
  });
});

describe("lineTotal", () => {
  it("is quantity × price per piece, exact to the paisa", () => {
    expect(lineTotal("2.50", 5000)).toBe("12500.00");
    expect(lineTotal("0.07", 3)).toBe("0.21");
    expect(lineTotal("1.10", 3)).toBe("3.30");
  });
});

describe("orderTotals", () => {
  it("sums the lines and works out Margin and Margin %", () => {
    expect(
      orderTotals([
        { sellTotal: "12500.00", buyTotal: "10000.00" },
        { sellTotal: "8000.00", buyTotal: "6000.00" },
        { sellTotal: "4000.00", buyTotal: "3600.00" },
      ]),
    ).toEqual({
      sell: "24500.00",
      buy: "19600.00",
      margin: "4900.00",
      marginPercent: 20,
    });
  });

  it("is zero with no lines", () => {
    expect(orderTotals([])).toEqual({
      sell: "0.00",
      buy: "0.00",
      margin: "0.00",
      marginPercent: 0,
    });
  });
});

describe("specText", () => {
  it("joins the specs a document prints, skipping blanks", () => {
    expect(
      specText({
        size: "10×14 in",
        thickness: "40 micron",
        colour: null,
        printDetails: "2 colour, logo front",
      }),
    ).toBe("10×14 in / 40 micron / 2 colour, logo front");
    expect(
      specText({ size: null, thickness: null, colour: null, printDetails: "" }),
    ).toBe("");
  });
});

describe("orderListFilters", () => {
  const customer = "6f1d2b8e-3c4a-4e5f-9a7b-1c2d3e4f5a6b";

  it("reads the filters a dashboard tile or the filter form put in the URL", () => {
    expect(
      orderListFilters({
        q: " PO-77 ",
        status: "wo_sent",
        customer,
        from: "2026-10-01",
        to: "2026-10-31",
        page: "3",
      }),
    ).toEqual({
      query: "PO-77",
      status: "wo_sent",
      customerId: customer,
      from: "2026-10-01",
      to: "2026-10-31",
      page: 3,
    });
  });

  it("drops what it can't read, and starts on page 1", () => {
    expect(
      orderListFilters({
        status: "lost",
        customer: "C-0001",
        supplier: ["a", "b"],
        from: "1 Oct",
        to: "",
        page: "-2",
      }),
    ).toEqual({ query: "", page: 1 });
  });

  it("round-trips through orderListHref", () => {
    const filters = {
      query: "highway",
      status: "delivered" as const,
      supplierId: customer,
      to: "2026-10-31",
      page: 2,
    };
    const href = orderListHref(filters);
    const params = Object.fromEntries(
      new URL(href, "https://ze.test").searchParams,
    );
    expect(orderListFilters(params)).toEqual(filters);
  });

  it("links to the first page with no filters as plain /orders", () => {
    expect(orderListHref({ query: "", page: 1 })).toBe("/orders");
  });
});

describe("woProgress", () => {
  it("shows WO x/y only while some but not all Work Orders are sent", () => {
    expect(woProgress({ sent: 1, total: 2 })).toBe("WO 1/2");
    expect(woProgress({ sent: 2, total: 3 })).toBe("WO 2/3");
    expect(woProgress({ sent: 0, total: 2 })).toBeNull();
    expect(woProgress({ sent: 2, total: 2 })).toBeNull();
  });
});
// SPEC §5.4's example Order: two lines from Suzinas (WO-A), one from Rahim
// Plastics (WO-B), both Work Orders sent.
describe("editEffects", () => {
  const bread = {
    supplierId: "suzinas",
    productName: "Bread poly packet",
    specText: "10×14 in",
    quantity: 5000,
    buyPrice: "2.00",
  };
  const box = {
    supplierId: "suzinas",
    productName: "Sweet box 1 kg",
    specText: "",
    quantity: 1000,
    buyPrice: "6.00",
  };
  const bag = {
    supplierId: "rahim",
    productName: "Carry bag large",
    specText: "",
    quantity: 2000,
    buyPrice: "3.00",
  };
  type WoStatus = "pending" | "sent" | "cancelled";
  const before: PrintedOrder = {
    deliveryDate: "2026-10-25",
    customerRef: "PO-77",
    deliveryAddress: "12 Station Road, Dhaka",
    lines: [bread, box, bag],
  };
  const woA = {
    id: "a",
    supplierId: "suzinas",
    woNo: "WO-2026-0012-A",
    supplierName: "Suzinas",
    status: "sent" as WoStatus,
  };
  const woB = {
    id: "b",
    supplierId: "rahim",
    woNo: "WO-2026-0012-B",
    supplierName: "Rahim Plastics",
    status: "sent" as WoStatus,
  };
  const effects = (
    after: Partial<typeof before>,
    { workOrders = [woA, woB], challanSent = true } = {},
  ) =>
    editEffects({
      before,
      after: { ...before, ...after },
      workOrders,
      challanSent,
    });

  it("changes nothing when what the documents print is the same", () => {
    expect(
      effects({ lines: [{ ...bread }, { ...box, buyPrice: "6" }, bag] }),
    ).toEqual({ resend: [], cancelled: [], deleted: [], challan: false });
  });

  it("flags only the sent Work Order whose lines changed, and the sent Challan", () => {
    expect(
      effects({ lines: [{ ...bread, quantity: 6000 }, box, bag] }),
    ).toEqual({ resend: [woA], cancelled: [], deleted: [], challan: true });
  });

  it("flags a Work Order, not the Challan, for a Buy price change", () => {
    expect(
      effects({ lines: [bread, box, { ...bag, buyPrice: "3.20" }] }),
    ).toEqual({ resend: [woB], cancelled: [], deleted: [], challan: false });
  });

  it("flags every sent Work Order when the required-by date changes", () => {
    expect(effects({ deliveryDate: null })).toEqual({
      resend: [woA, woB],
      cancelled: [],
      deleted: [],
      challan: false,
    });
  });

  it("flags the Challan for its reference, delivery address or line order", () => {
    for (const after of [
      { customerRef: "PO-78" },
      { deliveryAddress: "Gate 2, Station Road" },
      { lines: [bread, bag, box] },
    ])
      expect(effects(after)).toMatchObject({ resend: [], challan: true });
  });

  it("never flags documents that were not sent", () => {
    const pending = { ...woA, status: "pending" as const };
    expect(
      effects(
        { lines: [{ ...bread, quantity: 1 }, box, bag] },
        { workOrders: [pending, woB], challanSent: false },
      ),
    ).toEqual({ resend: [], cancelled: [], deleted: [], challan: false });
  });

  it("cancels a sent Work Order whose Supplier has no lines left, and deletes a pending one", () => {
    expect(effects({ lines: [bag] })).toEqual({
      resend: [],
      cancelled: [woA],
      deleted: [],
      challan: true,
    });
    const pendingB = { ...woB, status: "pending" as const };
    expect(
      effects({ lines: [bread, box] }, { workOrders: [woA, pendingB] }),
    ).toEqual({
      resend: [],
      cancelled: [],
      deleted: [pendingB],
      challan: true,
    });
  });

  it("leaves an already cancelled Work Order alone", () => {
    const cancelled = { ...woB, status: "cancelled" as const };
    expect(
      effects({ lines: [bread, box] }, { workOrders: [woA, cancelled] }),
    ).toMatchObject({ cancelled: [], deleted: [] });
  });
});

describe("editWarnings", () => {
  const wo = (letter: string, supplierName: string) => ({
    woNo: `WO-2026-0012-${letter}`,
    supplierName,
  });

  it("lists what no longer matches what was sent", () => {
    expect(
      editWarnings({
        resend: [wo("A", "Suzinas")],
        cancelled: [wo("B", "Rahim Plastics")],
        deleted: [wo("C", "Plastech")],
        challan: true,
      }),
    ).toEqual([
      "WO-2026-0012-A to Suzinas no longer matches and will need re-sending.",
      "WO-2026-0012-B to Rahim Plastics will be cancelled: Rahim Plastics has no items left.",
      "The Challan no longer matches and will need re-sending.",
    ]);
  });

  it("is empty when nothing sent is affected", () => {
    expect(
      editWarnings({ resend: [], cancelled: [], deleted: [], challan: false }),
    ).toEqual([]);
  });
});
