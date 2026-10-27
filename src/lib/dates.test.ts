import { describe, expect, it } from "vitest";
import { formatDate, todayInDhaka } from "@/lib/dates";

describe("todayInDhaka", () => {
  it("is already tomorrow in Dhaka by 18:00 UTC", () => {
    expect(todayInDhaka(new Date("2026-12-31T17:59:00Z"))).toBe("2026-12-31");
    expect(todayInDhaka(new Date("2026-12-31T18:00:00Z"))).toBe("2027-01-01");
  });
});

describe("formatDate", () => {
  it("shows a date column as day, short month, year", () => {
    expect(formatDate("2026-10-16")).toBe("16 Oct 2026");
    expect(formatDate("2027-01-01")).toBe("1 Jan 2027");
  });
});
