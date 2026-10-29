import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { z } from "zod";
import {
  TIMEZONE,
  formatDate,
  formatDateTime,
  todayInDhaka,
} from "@/lib/dates";
import { param, type SearchParams } from "@/lib/fields";
import {
  ORDER_STATUS_LABEL,
  WO_STATUS_LABEL,
  type OrderStatus,
} from "@/lib/orders";
import { ROLE_LABEL, type Role } from "@/lib/permissions";

// The Activity Log screen and History tabs (SPEC §11.2): pure rules for
// turning activity_log rows into entries people read.

// One activity_log row, with the Order's number for rows that carry order_id.
export type ActivityRow = {
  id: number;
  txId: number;
  occurredAt: Date;
  kind: "data" | "event";
  action: string;
  userId: string | null;
  userName: string | null;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  orderId: string | null;
  orderNo: string | null;
  changes: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
};

// One save: every row written in one transaction (ADR 0001).
export type ActivityEntry = {
  txId: number;
  occurredAt: Date;
  userName: string;
  action: string;
  record: string;
  summary: string;
  details: EntryDetail[];
};

// The expanded view of one row: its field diff or event details.
export type EntryDetail = {
  id: number;
  title: string;
  fields: { label: string; from?: string; to?: string }[];
};

// The Record type filter: each covers the tables it is stored in.
export const RECORD_TYPES = {
  orders: { label: "Orders", tables: ["orders", "work_orders", "order_items"] },
  customers: { label: "Customers", tables: ["customers"] },
  suppliers: { label: "Suppliers", tables: ["suppliers"] },
  products: { label: "Products", tables: ["products"] },
  users: { label: "Users", tables: ["profiles"] },
  settings: { label: "Company settings", tables: ["company_settings"] },
} as const satisfies Record<string, { label: string; tables: string[] }>;
export type RecordType = keyof typeof RECORD_TYPES;

// The Action type filter, over activity_log.action (SPEC §14).
export const ACTION_TYPES = {
  created: { label: "Created", actions: ["insert"] },
  edited: { label: "Edited", actions: ["update"] },
  deleted: { label: "Deleted", actions: ["delete"] },
  status: {
    label: "Status and locking",
    actions: ["status_change", "lock", "unlock", "cancel", "restore"],
  },
  documents: {
    label: "Documents",
    actions: ["document_download", "document_share", "document_date_change"],
  },
  auth: {
    label: "Sign-in and passwords",
    actions: [
      "login",
      "login_failed",
      "logout",
      "password_change",
      "password_reset",
    ],
  },
} as const satisfies Record<string, { label: string; actions: string[] }>;
export type ActionType = keyof typeof ACTION_TYPES;

const ACTION_LABEL: Record<string, string> = {
  insert: "Created",
  update: "Edited",
  delete: "Deleted",
  status_change: "Status changed",
  document_download: "Downloaded",
  document_share: "Shared",
  document_date_change: "Date changed",
  lock: "Locked",
  unlock: "Unlocked",
  cancel: "Cancelled",
  restore: "Restored",
  login: "Signed in",
  login_failed: "Sign-in failed",
  logout: "Signed out",
  password_change: "Password changed",
  password_reset: "Password reset",
};

const NOUN: Record<string, string> = {
  orders: "order",
  work_orders: "work order",
  order_items: "item",
  customers: "customer",
  suppliers: "supplier",
  products: "product",
  profiles: "user",
};

const ORDER_TABLES: readonly string[] = RECORD_TYPES.orders.tables;

// Field names read better than column names; the rest lose their
// underscores.
const FIELD_LABEL: Record<string, string> = {
  full_name: "name",
  is_active: "active",
  is_locked: "locked",
  wo_no: "WO number",
  wo_date: "WO date",
  wo_letters_used: "WO letters used",
  needs_resend: "needs re-send",
  challan_needs_resend: "Challan needs re-send",
  challan_no: "Challan number",
  challan_date: "Challan date",
  challan_downloaded_at: "Challan sent",
  invoice_no: "Invoice number",
  invoice_date: "Invoice date",
  invoice_downloaded_at: "Invoice sent",
  order_no: "order number",
  customer_ref: "customer reference",
  whatsapp: "WhatsApp",
};

// Bookkeeping columns left out of a created or deleted row's values.
const HIDDEN_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
]);

const fieldLabel = (key: string) => FIELD_LABEL[key] ?? key.replace(/_/g, " ");

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// A stored value as shown: dates and statuses in their app wording.
function formatValue(table: string | null, key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (key === "status" || key === "status_before_cancel") {
      const labels: Record<string, string> =
        table === "work_orders" ? WO_STATUS_LABEL : ORDER_STATUS_LABEL;
      return labels[value] ?? value;
    }
    if (key === "role") return ROLE_LABEL[value as Role] ?? value;
    if (ISO_DATE.test(value)) return formatDate(value);
    if (ISO_MOMENT.test(value)) return formatDateTime(new Date(value));
    return value;
  }
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

type Diff = Record<string, { from: unknown; to: unknown }>;

// What a record is called in the log: "Order ORD-2026-0012", "Product P-0031
// Bread poly packet". An Order's items and Work Orders count as the Order.
function recordOf(row: ActivityRow): string {
  if (row.orderNo && row.entityType && ORDER_TABLES.includes(row.entityType))
    return `Order ${row.orderNo}`;
  if (row.entityType === "company_settings") return "Company settings";
  if (!row.entityType) return text(row.details, "email") || "—";
  const noun = NOUN[row.entityType] ?? row.entityType;
  return `${capitalize(noun)} ${row.entityLabel ?? ""}`.trim();
}

function text(details: Record<string, unknown> | null, key: string): string {
  const value = details?.[key];
  return typeof value === "string" ? value : "";
}

// One row's sentence for an edit: "sell price 12.00 → 13.50" for a single
// field, else the fields that changed.
function changedFields(row: ActivityRow): string {
  const diff = (row.changes ?? {}) as Diff;
  const keys = Object.keys(diff);
  if (keys.length === 1) {
    const [key] = keys as [string];
    const { from, to } = diff[key]!;
    return `${fieldLabel(key)} ${formatValue(row.entityType, key, from)} → ${formatValue(row.entityType, key, to)}`;
  }
  const names = keys.map(fieldLabel);
  const shown =
    names.length > 3
      ? [...names.slice(0, 3), `${names.length - 3} more`]
      : names;
  return `${listOf(shown)} changed`;
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// A data row on its own: "Edited product P-0031 …: sell price 12.00 → 13.50".
function dataSentence(row: ActivityRow): string {
  const subject =
    row.entityType === "company_settings"
      ? "company settings"
      : `${NOUN[row.entityType ?? ""] ?? row.entityType} ${row.entityLabel ?? ""}`.trim();
  if (row.action === "insert") return `Created ${subject}`;
  if (row.action === "delete") return `Deleted ${subject}`;
  const diff = (row.changes ?? {}) as Diff;
  const keys = Object.keys(diff);
  if (keys.length === 1 && keys[0] === "is_active")
    return `${diff.is_active!.to ? "Reactivated" : "Deactivated"} ${subject}`;
  return `Edited ${subject}: ${changedFields(row)}`;
}

// What happened to an Order's items and Work Orders in one save:
// "3 items changed, WO-B needs re-send".
function orderParts(rows: ActivityRow[]): string[] {
  const items = rows.filter((row) => row.entityType === "order_items");
  const count = (action: string, verb: string) => {
    const n = items.filter((row) => row.action === action).length;
    return n ? [`${n} ${n === 1 ? "item" : "items"} ${verb}`] : [];
  };
  const workOrders = rows
    .filter((row) => row.entityType === "work_orders")
    .flatMap((row) => {
      const diff = (row.changes ?? {}) as Diff;
      if (row.action === "insert") return [`${row.entityLabel} added`];
      if (row.action === "delete") return [`${row.entityLabel} removed`];
      if (diff.status?.to === "cancelled")
        return [`${row.entityLabel} cancelled`];
      if (diff.needs_resend?.to === true)
        return [`${row.entityLabel} needs re-send`];
      return [];
    });
  return [
    ...count("insert", "added"),
    ...count("delete", "removed"),
    ...count("update", "changed"),
    ...workOrders,
  ];
}

// The one-line summary of a save with no app event: its main record's
// change, and for an Order what happened to its lines.
function dataSummary(rows: ActivityRow[]): string {
  const order = rows.find((row) => row.entityType === "orders");
  const orderNo =
    order?.entityLabel ?? rows.find((row) => row.orderNo)?.orderNo;
  if (orderNo && rows.every((row) => ORDER_TABLES.includes(row.entityType!))) {
    const parts = orderParts(rows);
    if (order?.action === "insert" || order?.action === "delete")
      return `${dataSentence(order)}${parts.length ? `: ${parts.join(", ")}` : ""}`;
    const own = order ? [changedFields(order)] : [];
    const all = [...own, ...parts];
    return `Edited order ${orderNo}${all.length ? `: ${all.join(", ")}` : ""}`;
  }
  const [first, ...rest] = rows;
  const more = rest.length
    ? ` and ${rest.length} more ${rest.length === 1 ? "change" : "changes"}`
    : "";
  return `${dataSentence(first!)}${more}`;
}

// An app event's sentence (SPEC §11.1), as the Activity Log and the Order
// page's history (SPEC §6.4) show it.
export function eventLine({
  action,
  entityType,
  entityLabel,
  details,
}: Pick<ActivityRow, "action" | "entityType" | "entityLabel"> & {
  details: Record<string, unknown> | null;
}): string {
  const get = (key: string) => text(details, key);
  const date = (key: string) => (get(key) ? formatDate(get(key)) : "");
  const via = get("source") === "manual" ? "" : " (automatic)";
  const status = (key: string) =>
    ORDER_STATUS_LABEL[get(key) as OrderStatus] ?? get(key);
  const reason = get("reason") && `: ${get("reason")}`;
  switch (action) {
    case "document_download":
      return `Downloaded ${entityLabel}, dated ${date("date")}`;
    case "document_share":
      return `Shared ${entityLabel}, dated ${date("date")}`;
    case "document_date_change":
      return `Changed the date of ${entityLabel} from ${date("from")} to ${date("to")}`;
    case "status_change":
      if (entityType === "work_orders")
        return `${entityLabel} marked ${WO_STATUS_LABEL[get("to") as keyof typeof WO_STATUS_LABEL] ?? get("to")}`;
      return `Status ${status("from")} → ${status("to")}${via}${get("note") && `: ${get("note")}`}`;
    case "lock":
      return get("source") === "manual"
        ? `Order locked: marked ${status("to")}`
        : "Order locked: Invoice sent";
    case "unlock":
      return `Order unlocked${reason}`;
    case "cancel":
      return `Order cancelled${reason}`;
    case "restore":
      return `Order restored to ${status("to")}`;
    case "login":
      return "Signed in";
    case "login_failed":
      return `Failed sign-in as ${get("email") || "(no email)"}${get("reason") === "deactivated" ? ": account deactivated" : ""}`;
    case "logout":
      return "Signed out";
    case "password_change":
      return "Changed their password";
    case "password_reset":
      return get("by") === "admin"
        ? `Reset the password of ${entityLabel}`
        : "Reset their password";
    default:
      return ACTION_LABEL[action] ?? action;
  }
}

function detailOf(row: ActivityRow): EntryDetail {
  const title = `${ACTION_LABEL[row.action] ?? row.action} · ${
    row.entityType &&
    ORDER_TABLES.includes(row.entityType) &&
    row.entityType !== "orders"
      ? `${capitalize(NOUN[row.entityType]!)} ${row.entityLabel ?? ""}`.trim()
      : recordOf(row)
  }`;
  const value = (key: string, raw: unknown) =>
    formatValue(row.entityType, key, raw);
  const shown = (record: Record<string, unknown> | null) =>
    Object.entries(record ?? {}).filter(
      ([key]) => !HIDDEN_FIELDS.has(key) && !key.endsWith("_id"),
    );
  let fields: EntryDetail["fields"];
  if (row.kind === "event") {
    fields = shown(row.details).map(([key, raw]) => ({
      label: capitalize(fieldLabel(key)),
      to: value(key, raw),
    }));
  } else if (row.action === "update") {
    fields = Object.entries((row.changes ?? {}) as Diff).map(
      ([key, { from, to }]) => ({
        label: capitalize(fieldLabel(key)),
        from: value(key, from),
        to: value(key, to),
      }),
    );
  } else {
    const side = row.action === "insert" ? "to" : "from";
    fields = shown(row.changes).map(([key, raw]) => ({
      label: capitalize(fieldLabel(key)),
      [side]: value(key, raw),
    }));
  }
  return { id: row.id, title, fields };
}

// One save's rows (one tx_id, oldest first) as the entry the log shows.
export function summarizeEntry(rows: readonly ActivityRow[]): ActivityEntry {
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  const events = ordered.filter((row) => row.kind === "event");
  const main =
    events[0] ??
    ordered.find((row) => row.entityType === "orders") ??
    ordered.find(
      (row) => !row.entityType || !ORDER_TABLES.includes(row.entityType),
    ) ??
    ordered[0]!;
  return {
    txId: main.txId,
    occurredAt: main.occurredAt,
    userName: main.userName ?? "—",
    action: ACTION_LABEL[main.action] ?? main.action,
    record: recordOf(main),
    summary: events.length
      ? events.map(eventLine).join("; ")
      : dataSummary(ordered),
    details: ordered.map(detailOf),
  };
}

// Rows of several saves, newest save first, as entries in that order.
export function groupEntries(rows: readonly ActivityRow[]): ActivityEntry[] {
  const byTx = new Map<number, ActivityRow[]>();
  for (const row of rows) {
    const group = byTx.get(row.txId);
    if (group) group.push(row);
    else byTx.set(row.txId, [row]);
  }
  return [...byTx.values()].map(summarizeEntry);
}

// The day an entry falls on in Dhaka, YYYY-MM-DD, and its header wording:
// "Mon, 19 Oct 2026".
export const dayOf = (moment: Date) => todayInDhaka(moment);

export function formatDay(day: string): string {
  return format(new TZDate(`${day}T12:00:00`, TIMEZONE), "EEE, d MMM yyyy");
}

// The screen's filters, kept in the URL so a view can be bookmarked.
export type ActivityFilters = {
  query: string;
  // Dhaka calendar days, both ends included (YYYY-MM-DD).
  from?: string;
  to?: string;
  userId?: string;
  recordType?: RecordType;
  actionType?: ActionType;
  page: number;
};

const recordTypes = Object.keys(RECORD_TYPES) as [RecordType, ...RecordType[]];
const actionTypes = Object.keys(ACTION_TYPES) as [ActionType, ...ActionType[]];

// Reads the screen's URL; anything it can't read is left out.
export function activityFilters(params: SearchParams): ActivityFilters {
  const filters: ActivityFilters = {
    query: typeof params.q === "string" ? params.q.trim() : "",
    from: param(z.iso.date(), params.from),
    to: param(z.iso.date(), params.to),
    userId: param(z.uuid(), params.user),
    recordType: param(z.enum(recordTypes), params.record),
    actionType: param(z.enum(actionTypes), params.action),
    page: param(z.coerce.number().int().positive(), params.page) ?? 1,
  };
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as ActivityFilters;
}

// The URL for a filtered view; the inverse of activityFilters. `path` is
// the screen or its CSV export.
export function activityHref(
  filters: ActivityFilters,
  path = "/activity",
): string {
  const params = new URLSearchParams({
    ...(filters.query && { q: filters.query }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    ...(filters.userId && { user: filters.userId }),
    ...(filters.recordType && { record: filters.recordType }),
    ...(filters.actionType && { action: filters.actionType }),
    ...(filters.page > 1 && { page: String(filters.page) }),
  });
  return params.size ? `${path}?${params}` : path;
}

// The CSV export (SPEC §11.2): one line per entry.
export function entriesCsv(entries: readonly ActivityEntry[]): string {
  return toCsv([
    ["Time", "User", "Action", "Record", "Summary"],
    ...entries.map((entry) => [
      formatDateTime(entry.occurredAt),
      entry.userName,
      entry.action,
      entry.record,
      entry.summary,
    ]),
  ]);
}

// RFC 4180, with a leading quote on anything a spreadsheet would run as a
// formula.
export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
