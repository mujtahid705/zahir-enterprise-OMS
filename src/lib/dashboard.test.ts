import { describe, expect, it } from "vitest";
import { chartScale, formatLakh, lastMonths } from "@/lib/dashboard";

describe("lastMonths", () => {
  it("lists the six months up to and including today's, oldest first", () => {
    expect(lastMonths("2026-10-30")).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
  });

  it("runs back across a new year", () => {
    expect(lastMonths("2027-02-01", 3)).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("chartScale", () => {
  it("rounds the top up to four even steps", () => {
    expect(chartScale([5_12_400, 8_14_700, 7_84_350])).toEqual({
      max: 10_00_000,
      ticks: [0, 2_50_000, 5_00_000, 7_50_000, 10_00_000],
    });
  });

  it("picks a step from 1, 2, 2.5 and 5 at each power of ten", () => {
    expect(chartScale([3_10_000]).max).toBe(4_00_000);
    expect(chartScale([18_000]).max).toBe(20_000);
    expect(chartScale([1_00_000]).max).toBe(1_00_000);
  });

  it("still draws an axis when there's nothing to show", () => {
    expect(chartScale([0, 0])).toEqual({
      max: 1_00_000,
      ticks: [0, 25_000, 50_000, 75_000, 1_00_000],
    });
  });
});

describe("formatLakh", () => {
  it("shows amounts in lakh with one decimal, dropping a trailing .0", () => {
    expect(formatLakh(7_50_000)).toBe("7.5L");
    expect(formatLakh(2_00_000)).toBe("2L");
    expect(formatLakh(1_78_440)).toBe("1.8L");
    expect(formatLakh(0)).toBe("0");
  });

  it("keeps two decimals under a lakh", () => {
    expect(formatLakh(25_000)).toBe("0.25L");
    expect(formatLakh(50_000)).toBe("0.5L");
  });

  it("drops the decimal from 10 lakh up", () => {
    expect(formatLakh(12_40_000)).toBe("12L");
  });
});
