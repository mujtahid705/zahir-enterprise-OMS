import { describe, expect, it } from "vitest";
import { margin, priceSchema } from "@/lib/products";

describe("priceSchema", () => {
  it("accepts taka with up to two decimals, stored with two", () => {
    expect(priceSchema.parse("2.5")).toBe("2.50");
    expect(priceSchema.parse(" 1250 ")).toBe("1250.00");
    expect(priceSchema.parse("0.01")).toBe("0.01");
  });

  it("refuses zero, negative, blank and non-numbers", () => {
    for (const value of ["0", "0.00", "-3", "", "abc", "1,000"]) {
      expect(priceSchema.safeParse(value).success).toBe(false);
    }
  });

  it("refuses more than two decimals", () => {
    expect(priceSchema.safeParse("1.234").error?.issues[0]?.message).toBe(
      "Use at most 2 decimal places.",
    );
  });
});

describe("margin", () => {
  it("is sell minus buy per piece, and its share of sell", () => {
    expect(margin("2.50", "2.00")).toEqual({ perPiece: "0.50", percent: 20 });
    expect(margin("3.00", "2.10")).toEqual({ perPiece: "0.90", percent: 30 });
  });

  it("goes negative when buying costs more than selling", () => {
    expect(margin("1.00", "1.25")).toEqual({
      perPiece: "-0.25",
      percent: -25,
    });
  });
});
