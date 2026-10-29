import { describe, expect, it } from "vitest";
import {
  lineTotal,
  orderListFilters,
  orderListHref,
  orderTotals,
  specText,
  splitWorkOrders,
  statusTargets,
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

describe("statusTargets", () => {
  it("offers Staff only later steps, never Completed", () => {
    expect(statusTargets("staff", "created")).toEqual([
      "wo_sent",
      "delivered",
      "invoiced",
    ]);
    expect(statusTargets("staff", "delivered")).toEqual(["invoiced"]);
    expect(statusTargets("staff", "invoiced")).toEqual([]);
  });

  it("offers Admins and Managers every other step, back or forward", () => {
    expect(statusTargets("manager", "delivered")).toEqual([
      "created",
      "wo_sent",
      "invoiced",
      "completed",
    ]);
    expect(statusTargets("admin", "completed")).toEqual([
      "created",
      "wo_sent",
      "delivered",
      "invoiced",
    ]);
  });

  it("offers nothing on a cancelled Order: it is restored instead", () => {
    expect(statusTargets("admin", "cancelled")).toEqual([]);
    expect(statusTargets("staff", "cancelled")).toEqual([]);
  });
});
