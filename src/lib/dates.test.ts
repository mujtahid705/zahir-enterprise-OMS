import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMonth,
  todayInDhaka,
} from "@/lib/dates";

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

describe("formatDateTime", () => {
  it("shows a moment in Dhaka time", () => {
    expect(formatDateTime(new Date("2026-10-16T09:45:00Z"))).toBe(
      "16 Oct 2026, 3:45 PM",
    );
    expect(formatDateTime(new Date("2026-12-31T18:05:00Z"))).toBe(
      "1 Jan 2027, 12:05 AM",
    );
  });
});

describe("formatMonth", () => {
  it("shows a YYYY-MM month as month and year", () => {
    expect(formatMonth("2026-10")).toBe("Oct 2026");
    expect(formatMonth("1999-01")).toBe("Jan 1999");
  });
});
