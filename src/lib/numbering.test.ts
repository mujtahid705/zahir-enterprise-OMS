import { describe, expect, it } from "vitest";
import { formatCode } from "@/lib/numbering";

describe("formatCode", () => {
  it("pads master data codes to four digits", () => {
    expect(formatCode("C", 1)).toBe("C-0001");
    expect(formatCode("S", 42)).toBe("S-0042");
  });

  it("grows past 9999 instead of wrapping", () => {
    expect(formatCode("P", 12345)).toBe("P-12345");
  });
});
