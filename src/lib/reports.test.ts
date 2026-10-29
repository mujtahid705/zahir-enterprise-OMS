import { describe, expect, it } from "vitest";
import { reportCsv, reportFilters, reportHref } from "@/lib/reports";

describe("reportCsv", () => {
  it("writes a header row, then one row per line, with CRLF endings and a BOM for Excel", () => {
    const csv = reportCsv(
      [
        { key: "customer", label: "Customer", kind: "text" },
        { key: "orders", label: "Orders", kind: "count" },
        { key: "sell", label: "Sell total", kind: "money" },
        { key: "marginPercent", label: "Margin %", kind: "percent" },
      ],
      [
        {
          customer: "Highway Sweets",
          orders: 2,
          sell: "28500.00",
          marginPercent: 22.8,
        },
        {
          customer: "Rahim, Sons & Co",
          orders: 1,
          sell: "-5.00",
          marginPercent: -1.5,
        },
      ],
    );

    expect(csv).toBe(
      "\uFEFFCustomer,Orders,Sell total,Margin %\r\n" +
        "Highway Sweets,2,28500.00,22.8\r\n" +
        '"Rahim, Sons & Co",1,-5.00,-1.5\r\n',
    );
  });

  it("defuses text a spreadsheet would run as a formula, but keeps negative amounts as numbers", () => {
    const csv = reportCsv(
      [
        { key: "customer", label: "Customer", kind: "text" },
        { key: "margin", label: "Margin", kind: "money" },
      ],
      [
        { customer: "=HYPERLINK(1)", margin: "-12.00" },
        { customer: "@SUM(A1)", margin: "0.00" },
      ],
    );

    expect(csv.split("\r\n").slice(1, 3)).toEqual([
      "'=HYPERLINK(1),-12.00",
      "'@SUM(A1),0.00",
    ]);
  });
});

describe("reportFilters", () => {
  it("reads the report, order date range and page from the URL", () => {
    expect(
      reportFilters({
        report: "customers",
        from: "2026-10-01",
        to: "2026-10-31",
        page: "2",
      }),
    ).toEqual({
      report: "customers",
      from: "2026-10-01",
      to: "2026-10-31",
      page: 2,
    });
  });

  it("falls back to Margin by order, all dates, page 1 for anything it can't read", () => {
    expect(
      reportFilters({ report: "profit", from: "1 Oct", to: ["x"], page: "-1" }),
    ).toEqual({ report: "orders", page: 1 });
  });
});

describe("reportHref", () => {
  it("is the inverse of reportFilters, leaving out defaults", () => {
    const filters = {
      report: "open",
      from: "2026-10-01",
      to: "2026-10-31",
      page: 3,
    } as const;
    const href = reportHref(filters);

    expect(href).toBe(
      "/reports?report=open&from=2026-10-01&to=2026-10-31&page=3",
    );
    expect(
      reportFilters(Object.fromEntries(new URL(href, "http://x").searchParams)),
    ).toEqual(filters);
    expect(reportHref({ report: "orders", page: 1 })).toBe("/reports");
  });

  it("builds the CSV export link for the same report and range, without a page", () => {
    expect(
      reportHref(
        { report: "months", from: "2026-01-01", page: 2 },
        "/reports/export",
      ),
    ).toBe("/reports/export?report=months&from=2026-01-01");
  });
});
