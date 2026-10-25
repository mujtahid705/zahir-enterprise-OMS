import { describe, expect, it } from "vitest";
import { formatMoney, formatPieces } from "@/lib/money";

describe("formatMoney", () => {
  it("prints Tk with paisa", () => {
    expect(formatMoney("2.5")).toBe("Tk 2.50");
    expect(formatMoney("0.75")).toBe("Tk 0.75");
  });

  it("groups digits in lakh and crore", () => {
    expect(formatMoney("125000")).toBe("Tk 1,25,000.00");
    expect(formatMoney("10000000")).toBe("Tk 1,00,00,000.00");
    expect(formatMoney("999.99")).toBe("Tk 999.99");
    expect(formatMoney("1000")).toBe("Tk 1,000.00");
  });

  it("puts the sign before Tk", () => {
    expect(formatMoney("-1500.5")).toBe("-Tk 1,500.50");
  });
});

describe("formatPieces", () => {
  it("groups quantities in lakh too", () => {
    expect(formatPieces(5000)).toBe("5,000 pcs");
    expect(formatPieces(120000)).toBe("1,20,000 pcs");
    expect(formatPieces(1)).toBe("1 pcs");
  });
});
