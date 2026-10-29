import { z } from "zod";

// Reports (SPEC §10): pure rules shared by the Reports page, its CSV
// export and the reports service.

export type ColumnKind =
  | "text"
  | "date"
  | "month"
  | "status"
  | "money"
  | "pieces"
  | "count"
  | "percent"
  | "days";

export type Column = { key: string; label: string; kind: ColumnKind };

export type ReportRow = Record<string, string | number | null>;

// One CSV field: quoted when it holds a comma, quote or line break. Text
// typed by Users (names, references) that a spreadsheet would run as a
// formula gets a leading apostrophe; numbers are left alone.
function csvField(value: string | number | null, kind: ColumnKind): string {
  let text = value === null ? "" : String(value);
  if (kind === "text" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// A report as CSV: a header row of column labels, then one row per line.
// Money stays plain ("28500.00") so a spreadsheet can sum it; the BOM
// tells Excel the file is UTF-8.
export function reportCsv(
  columns: readonly Column[],
  rows: readonly ReportRow[],
): string {
  const lines = [
    columns.map((column) => csvField(column.label, "text")),
    ...rows.map((row) =>
      columns.map((column) => csvField(row[column.key] ?? null, column.kind)),
    ),
  ];
  return `\uFEFF${lines.map((line) => `${line.join(",")}\r\n`).join("")}`;
}

const money = (key: string, label: string): Column => ({
  key,
  label,
  kind: "money",
});
const MARGIN: Column[] = [
  money("margin", "Margin"),
  { key: "marginPercent", label: "Margin %", kind: "percent" },
];

// The six reports (SPEC §10), in tab order, with the columns each shows and
// exports. Margin % = Margin ÷ Sell total (GLOSSARY).
export const REPORTS = {
  orders: {
    title: "Margin by order",
    columns: [
      { key: "orderNo", label: "Order", kind: "text" },
      { key: "customerName", label: "Customer", kind: "text" },
      { key: "orderDate", label: "Order date", kind: "date" },
      money("sell", "Sell total"),
      money("buy", "Buy total"),
      ...MARGIN,
    ],
  },
  months: {
    title: "By month",
    columns: [
      { key: "month", label: "Month", kind: "month" },
      { key: "orders", label: "Orders", kind: "count" },
      money("sell", "Sell total"),
      money("buy", "Buy total"),
      ...MARGIN,
    ],
  },
  customers: {
    title: "By customer",
    columns: [
      { key: "customerName", label: "Customer", kind: "text" },
      { key: "orders", label: "Orders", kind: "count" },
      money("sell", "Sell total"),
      ...MARGIN,
    ],
  },
  suppliers: {
    title: "By supplier",
    columns: [
      { key: "supplierName", label: "Supplier", kind: "text" },
      { key: "workOrders", label: "WOs", kind: "count" },
      { key: "quantity", label: "Quantity", kind: "pieces" },
      money("buy", "Buy total"),
    ],
  },
  products: {
    title: "By product",
    columns: [
      { key: "productCode", label: "Code", kind: "text" },
      { key: "productName", label: "Product", kind: "text" },
      { key: "customerName", label: "Customer", kind: "text" },
      { key: "quantity", label: "Quantity", kind: "pieces" },
      money("sell", "Sell total"),
      money("buy", "Buy total"),
      ...MARGIN,
    ],
  },
  open: {
    title: "Open orders",
    columns: [
      { key: "orderNo", label: "Order", kind: "text" },
      { key: "customerName", label: "Customer", kind: "text" },
      { key: "orderDate", label: "Order date", kind: "date" },
      { key: "status", label: "Status", kind: "status" },
      { key: "ageDays", label: "Age (days)", kind: "days" },
      money("sell", "Sell total"),
    ],
  },
} as const satisfies Record<string, { title: string; columns: Column[] }>;

export type ReportKind = keyof typeof REPORTS;

export const REPORT_KINDS = Object.keys(REPORTS) as ReportKind[];

// Which report, and the order date range (both ends included, YYYY-MM-DD).
// No range means all dates.
export type ReportFilters = {
  report: ReportKind;
  from?: string;
  to?: string;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const param = <T>(schema: z.ZodType<T>, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
};

// Reads the Reports URL; anything it can't read is left out.
export function reportFilters(params: SearchParams): ReportFilters {
  const filters: ReportFilters = {
    report: param(z.enum(REPORT_KINDS), params.report) ?? "orders",
    from: param(z.iso.date(), params.from),
    to: param(z.iso.date(), params.to),
    page: param(z.coerce.number().int().positive(), params.page) ?? 1,
  };
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as ReportFilters;
}

// The URL for a report; the inverse of reportFilters. The CSV export
// (`/reports/export`) takes the same filters but has no pages.
export function reportHref(
  filters: ReportFilters,
  path: "/reports" | "/reports/export" = "/reports",
): string {
  const params = new URLSearchParams({
    ...(filters.report !== "orders" && { report: filters.report }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    ...(path === "/reports" &&
      filters.page > 1 && { page: String(filters.page) }),
  });
  return params.size ? `${path}?${params}` : path;
}
