import { describe, expect, it } from "vitest";
import { formatCode, orderNumbers, workOrderNo } from "@/lib/numbering";

describe("formatCode", () => {
  it("pads master data codes to four digits", () => {
    expect(formatCode("C", 1)).toBe("C-0001");
    expect(formatCode("S", 42)).toBe("S-0042");
  });

  it("grows past 9999 instead of wrapping", () => {
    expect(formatCode("P", 12345)).toBe("P-12345");
  });
});

describe("orderNumbers", () => {
  it("ties the Order, Challan and Invoice to one yearly sequence number", () => {
    expect(orderNumbers(2026, 12)).toEqual({
      orderNo: "ORD-2026-0012",
      challanNo: "CH-2026-0012",
      invoiceNo: "INV-2026-0012",
    });
  });

  it("grows past 9999 instead of wrapping", () => {
    expect(orderNumbers(2026, 10000).orderNo).toBe("ORD-2026-10000");
  });
});

describe("workOrderNo", () => {
  it("adds the Supplier letter to the Order's number", () => {
    expect(workOrderNo(2026, 12, "A")).toBe("WO-2026-0012-A");
    expect(workOrderNo(2026, 12, "C")).toBe("WO-2026-0012-C");
  });
});
