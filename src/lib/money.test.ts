import { describe, expect, it } from "vitest";
import { amountInWords, formatMoney, formatPieces } from "@/lib/money";

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

describe("amountInWords", () => {
  it("writes taka in lakh and crore", () => {
    expect(amountInWords("125000")).toBe(
      "Taka One Lakh Twenty-Five Thousand Only",
    );
    expect(amountInWords("10000000")).toBe("Taka One Crore Only");
    expect(amountInWords("28500")).toBe(
      "Taka Twenty-Eight Thousand Five Hundred Only",
    );
    expect(amountInWords("1")).toBe("Taka One Only");
    expect(amountInWords("0")).toBe("Taka Zero Only");
  });

  it("adds paisa when present", () => {
    expect(amountInWords("125000.50")).toBe(
      "Taka One Lakh Twenty-Five Thousand and Fifty Paisa Only",
    );
    expect(amountInWords("12.05")).toBe("Taka Twelve and Five Paisa Only");
  });

  it("names every place of a large amount", () => {
    expect(amountInWords("123456789.99")).toBe(
      "Taka Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine and Ninety-Nine Paisa Only",
    );
    expect(amountInWords("9999999999")).toBe(
      "Taka Nine Hundred Ninety-Nine Crore Ninety-Nine Lakh Ninety-Nine Thousand Nine Hundred Ninety-Nine Only",
    );
    expect(amountInWords("100100")).toBe("Taka One Lakh One Hundred Only");
  });
});
