import { describe, expect, it } from "vitest";
import {
  lineTotal,
  orderTotals,
  specText,
  splitWorkOrders,
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
