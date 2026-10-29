import { describe, expect, it } from "vitest";
import {
  activityFilters,
  activityHref,
  entriesCsv,
  formatDay,
  groupEntries,
  summarizeEntry,
  toCsv,
  type ActivityRow,
} from "@/lib/activity-log";

let nextId = 1;
function row(overrides: Partial<ActivityRow>): ActivityRow {
  return {
    id: nextId++,
    txId: 7,
    occurredAt: new Date("2026-10-19T09:45:00Z"),
    kind: "data",
    action: "update",
    userId: "u1",
    userName: "Rahim Admin",
    entityType: "products",
    entityId: "p1",
    entityLabel: "P-0031 Bread poly packet",
    orderId: null,
    orderNo: null,
    changes: null,
    details: null,
    ...overrides,
  };
}

describe("summarizeEntry", () => {
  it("summarises a one-field edit with its before and after", () => {
    const entry = summarizeEntry([
      row({ changes: { sell_price: { from: "12.00", to: "13.50" } } }),
    ]);

    expect(entry).toMatchObject({
      action: "Edited",
      record: "Product P-0031 Bread poly packet",
      summary:
        "Edited product P-0031 Bread poly packet: sell price 12.00 → 13.50",
    });
  });

  it("sums up an Order edit by its items and Work Orders (SPEC §11.2)", () => {
    const order = { orderId: "o1", orderNo: "ORD-2026-0012" };
    const item = (label: string) =>
      row({
        ...order,
        entityType: "order_items",
        entityLabel: label,
        changes: { quantity: { from: 100, to: 200 } },
      });
    const entry = summarizeEntry([
      item("Bread poly packet"),
      item("Cake box"),
      item("Sweet box"),
      row({
        ...order,
        entityType: "work_orders",
        entityLabel: "WO-2026-0012-B",
        changes: { needs_resend: { from: false, to: true } },
      }),
    ]);

    expect(entry).toMatchObject({
      action: "Edited",
      record: "Order ORD-2026-0012",
      summary:
        "Edited order ORD-2026-0012: 3 items changed, WO-2026-0012-B needs re-send",
    });
    expect(entry.details[0]).toEqual({
      id: expect.any(Number),
      title: "Edited · Item Bread poly packet",
      fields: [{ label: "Quantity", from: "100", to: "200" }],
    });
  });

  it("sums up a new Order by what it was created with", () => {
    const order = { orderId: "o1", orderNo: "ORD-2026-0115" };
    const entry = summarizeEntry([
      row({
        ...order,
        action: "insert",
        entityType: "orders",
        entityLabel: "ORD-2026-0115",
        changes: {},
      }),
      row({
        ...order,
        action: "insert",
        entityType: "work_orders",
        entityLabel: "WO-2026-0115-A",
        changes: {},
      }),
      row({
        ...order,
        action: "insert",
        entityType: "order_items",
        entityLabel: "Bread poly packet",
        changes: {},
      }),
    ]);

    expect(entry.summary).toBe(
      "Created order ORD-2026-0115: 1 item added, WO-2026-0115-A added",
    );
  });

  it("leads a send with its events, not the rows they changed", () => {
    const order = { orderId: "o1", orderNo: "ORD-2026-0012" };
    const entry = summarizeEntry([
      row({
        ...order,
        kind: "event",
        action: "document_download",
        entityType: "work_orders",
        entityLabel: "WO-2026-0012-A",
        details: { document: "work_order", date: "2026-10-19" },
      }),
      row({
        ...order,
        kind: "event",
        action: "status_change",
        entityType: "orders",
        entityLabel: "ORD-2026-0012",
        details: { from: "created", to: "wo_sent", source: "auto" },
      }),
      row({
        ...order,
        entityType: "orders",
        entityLabel: "ORD-2026-0012",
        changes: { status: { from: "created", to: "wo_sent" } },
      }),
    ]);

    expect(entry).toMatchObject({
      action: "Downloaded",
      record: "Order ORD-2026-0012",
      summary:
        "Downloaded WO-2026-0012-A, dated 19 Oct 2026; Status Created → WO Sent (automatic)",
    });
    expect(entry.details[2]!.fields).toEqual([
      { label: "Status", from: "Created", to: "WO Sent" },
    ]);
  });

  it("calls a deactivation by its name", () => {
    const entry = summarizeEntry([
      row({
        entityType: "customers",
        entityLabel: "C-0004 Highway Sweets",
        changes: { is_active: { from: true, to: false } },
      }),
    ]);

    expect(entry.summary).toBe("Deactivated customer C-0004 Highway Sweets");
  });

  it("lists the fields of a several-field edit", () => {
    const entry = summarizeEntry([
      row({
        entityType: "profiles",
        entityLabel: "Karim Staff",
        changes: {
          full_name: { from: "Karim", to: "Karim Staff" },
          role: { from: "staff", to: "manager" },
        },
      }),
    ]);

    expect(entry.summary).toBe(
      "Edited user Karim Staff: name and role changed",
    );
    expect(entry.details[0]!.fields[1]).toEqual({
      label: "Role",
      from: "Staff",
      to: "Manager",
    });
  });

  it("shows a created record's values without its bookkeeping columns", () => {
    const entry = summarizeEntry([
      row({
        action: "insert",
        changes: {
          id: "p1",
          code: "P-0031",
          name: "Bread poly packet",
          customer_id: "c1",
          sell_price: "12.00",
          is_active: true,
          created_at: "2026-10-19T09:45:00+00:00",
        },
      }),
    ]);

    expect(entry.summary).toBe("Created product P-0031 Bread poly packet");
    expect(entry.details[0]!.fields).toEqual([
      { label: "Code", to: "P-0031" },
      { label: "Name", to: "Bread poly packet" },
      { label: "Sell price", to: "12.00" },
      { label: "Active", to: "Yes" },
    ]);
  });

  it("names a failed sign-in by the email tried", () => {
    const entry = summarizeEntry([
      row({
        kind: "event",
        action: "login_failed",
        userId: null,
        userName: null,
        entityType: null,
        entityId: null,
        entityLabel: null,
        details: { email: "who@x.ze" },
      }),
    ]);

    expect(entry).toMatchObject({
      userName: "—",
      action: "Sign-in failed",
      record: "who@x.ze",
      summary: "Failed sign-in as who@x.ze",
    });
  });
});

describe("groupEntries", () => {
  it("makes one entry per save, newest save first", () => {
    const entries = groupEntries([
      row({ txId: 9, changes: { name: { from: "A", to: "B" } } }),
      row({ txId: 9, entityLabel: "P-0032 Cake box", changes: {} }),
      row({ txId: 8, action: "delete", changes: {} }),
    ]);

    expect(entries.map((entry) => [entry.txId, entry.details.length])).toEqual([
      [9, 2],
      [8, 1],
    ]);
    expect(entries[0]!.summary).toBe(
      "Edited product P-0031 Bread poly packet: name A → B and 1 more change",
    );
  });
});

describe("formatDay", () => {
  it("heads a day as in SPEC §11.2", () => {
    expect(formatDay("2026-10-19")).toBe("Mon, 19 Oct 2026");
  });
});

describe("activityFilters", () => {
  it("round-trips through the URL", () => {
    const href = activityHref({
      query: "ORD-2026",
      from: "2026-10-01",
      to: "2026-10-31",
      userId: "6f1c3f7e-2a4b-4c1d-9e8f-0a1b2c3d4e5f",
      recordType: "orders",
      actionType: "edited",
      page: 2,
    });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);

    expect(activityFilters(params)).toEqual({
      query: "ORD-2026",
      from: "2026-10-01",
      to: "2026-10-31",
      userId: "6f1c3f7e-2a4b-4c1d-9e8f-0a1b2c3d4e5f",
      recordType: "orders",
      actionType: "edited",
      page: 2,
    });
  });

  it("leaves out what it can't read", () => {
    expect(
      activityFilters({ record: "nope", user: "1", from: "today", page: "-1" }),
    ).toEqual({ query: "", page: 1 });
    expect(activityHref({ query: "", page: 1 })).toBe("/activity");
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and defuses formulas", () => {
    expect(
      toCsv([
        ["a,b", 'say "hi"', "two\nlines"],
        ["=SUM(A1)", "plain"],
      ]),
    ).toBe('"a,b","say ""hi""","two\nlines"\r\n\'=SUM(A1),plain\r\n');
  });

  it("exports one line per entry", () => {
    const csv = entriesCsv([
      summarizeEntry([
        row({ changes: { sell_price: { from: "12.00", to: "13.50" } } }),
      ]),
    ]);

    expect(csv.split("\r\n")).toEqual([
      "Time,User,Action,Record,Summary",
      '"19 Oct 2026, 3:45 PM",Rahim Admin,Edited,Product P-0031 Bread poly packet,Edited product P-0031 Bread poly packet: sell price 12.00 → 13.50',
      "",
    ]);
  });
});
