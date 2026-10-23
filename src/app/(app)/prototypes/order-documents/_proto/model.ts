// PROTOTYPE ONLY: in-memory order + documents state and the SPEC §6 auto-status rules.

export type OrderStatus =
  "created" | "wo_sent" | "delivered" | "invoiced" | "completed" | "cancelled";

export type WoState = {
  letter: string;
  supplier: string;
  supplierPhone: string;
  items: { name: string; qty: number; buy: number }[];
  status: "pending" | "sent" | "cancelled";
  needsResend: boolean;
  date: string | null; // stored document date
  sentAt: string | null;
  supplierTold: boolean; // cancelled WO acknowledged
};

export type DocState = {
  date: string | null;
  sentAt: string | null;
  needsResend: boolean;
};

export type OrderState = {
  status: OrderStatus;
  locked: boolean;
  wos: WoState[];
  challan: DocState;
  invoice: DocState;
};

export type DocRef =
  { kind: "wo"; letter: string } | { kind: "challan" } | { kind: "invoice" };

export const ORDER = {
  no: "ORD-2026-0012",
  seq: "2026-0012",
  orderDate: "2026-10-20",
  deliveryDate: "2026-10-28",
  customer: "Highway Sweets",
  customerPhone: "01711-245 880",
  customerAddress: "House 12, Road 4, Dhanmondi, Dhaka",
  customerRef: "HS/PO/2291",
  items: [
    {
      name: "Bread poly packet",
      spec: "10 × 14 in · 40 mic · 2-colour",
      qty: 5000,
      sell: 2.4,
      buy: 1.85,
      wo: "A",
    },
    {
      name: "Sweet box 1 kg",
      spec: "Duplex · window lid · gold foil",
      qty: 1000,
      sell: 18.5,
      buy: 14.2,
      wo: "A",
    },
    {
      name: "Carry bag large",
      spec: "16 × 20 in · 60 mic · white",
      qty: 2000,
      sell: 6.75,
      buy: 5.3,
      wo: "B",
    },
  ],
};

export const TODAY = "2026-10-23";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  created: "Created",
  wo_sent: "WO Sent",
  delivered: "Delivered",
  invoiced: "Invoiced",
  completed: "Completed",
  cancelled: "Cancelled",
};

const RANK: Record<OrderStatus, number> = {
  created: 0,
  wo_sent: 1,
  delivered: 2,
  invoiced: 3,
  completed: 4,
  cancelled: 5,
};

const forward = (from: OrderStatus, to: OrderStatus) =>
  from !== "cancelled" && RANK[to] > RANK[from] ? to : from;

const blankDoc: DocState = { date: null, sentAt: null, needsResend: false };

const wo = (
  letter: string,
  supplier: string,
  supplierPhone: string,
  items: WoState["items"],
  extra: Partial<WoState> = {},
): WoState => ({
  letter,
  supplier,
  supplierPhone,
  items,
  status: "pending",
  needsResend: false,
  date: null,
  sentAt: null,
  supplierTold: false,
  ...extra,
});

const SUZINAS = (extra?: Partial<WoState>) =>
  wo(
    "A",
    "Suzinas Poly Industries",
    "8801712000111",
    [
      { name: "Bread poly packet", qty: 5000, buy: 1.85 },
      { name: "Sweet box 1 kg", qty: 1000, buy: 14.2 },
    ],
    extra,
  );
const RAHIM = (extra?: Partial<WoState>) =>
  wo(
    "B",
    "Rahim Plastics",
    "8801819000222",
    [{ name: "Carry bag large", qty: 2000, buy: 5.3 }],
    extra,
  );

export const SCENARIOS: { id: string; label: string; state: OrderState }[] = [
  {
    id: "fresh",
    label: "Just saved",
    state: {
      status: "created",
      locked: false,
      wos: [SUZINAS(), RAHIM()],
      challan: blankDoc,
      invoice: blankDoc,
    },
  },
  {
    id: "partial",
    label: "1 of 2 WOs sent",
    state: {
      status: "created",
      locked: false,
      wos: [
        SUZINAS({
          status: "sent",
          date: "2026-10-21",
          sentAt: "21 Oct 2026, 11:20 AM",
        }),
        RAHIM(),
      ],
      challan: blankDoc,
      invoice: blankDoc,
    },
  },
  {
    id: "edited",
    label: "Edited after sending",
    state: {
      status: "delivered",
      locked: false,
      wos: [
        SUZINAS({
          status: "sent",
          needsResend: true,
          date: "2026-10-21",
          sentAt: "21 Oct 2026, 11:20 AM",
        }),
        RAHIM({
          status: "cancelled",
          date: "2026-10-21",
          sentAt: "21 Oct 2026, 11:24 AM",
        }),
        wo("C", "Dhaka Box & Carton", "8801913000333", [
          { name: "Carry bag large", qty: 2000, buy: 5.1 },
        ]),
      ],
      challan: {
        date: "2026-10-22",
        sentAt: "22 Oct 2026, 4:05 PM",
        needsResend: true,
      },
      invoice: blankDoc,
    },
  },
  {
    id: "locked",
    label: "Invoiced (locked)",
    state: {
      status: "invoiced",
      locked: true,
      wos: [
        SUZINAS({
          status: "sent",
          date: "2026-10-21",
          sentAt: "21 Oct 2026, 11:20 AM",
        }),
        RAHIM({
          status: "sent",
          date: "2026-10-21",
          sentAt: "21 Oct 2026, 11:24 AM",
        }),
      ],
      challan: {
        date: "2026-10-22",
        sentAt: "22 Oct 2026, 4:05 PM",
        needsResend: false,
      },
      invoice: {
        date: "2026-10-23",
        sentAt: "23 Oct 2026, 10:12 AM",
        needsResend: false,
      },
    },
  },
];

export const activeWos = (s: OrderState) =>
  s.wos.filter((w) => w.status !== "cancelled");
export const pendingWos = (s: OrderState) =>
  s.wos.filter((w) => w.status === "pending");

export function woProgress(s: OrderState) {
  const active = activeWos(s);
  return {
    sent: active.filter((w) => w.status === "sent").length,
    total: active.length,
  };
}

export function docNumber(ref: DocRef) {
  if (ref.kind === "wo") return `WO-${ORDER.seq}-${ref.letter}`;
  return ref.kind === "challan" ? `CH-${ORDER.seq}` : `INV-${ORDER.seq}`;
}

export function docTitle(ref: DocRef) {
  return ref.kind === "wo"
    ? "Work Order"
    : ref.kind === "challan"
      ? "Challan"
      : "Invoice";
}

export function getDoc(
  s: OrderState,
  ref: DocRef,
): DocState & { status?: WoState["status"] } {
  if (ref.kind === "wo") return s.wos.find((w) => w.letter === ref.letter)!;
  return s[ref.kind];
}

export const isSent = (s: OrderState, ref: DocRef) => !!getDoc(s, ref).sentAt;

// Warnings shown in the Share / Download dialog before confirming (SPEC §6.3, §8.0).
export function sendWarnings(s: OrderState, ref: DocRef, date: string) {
  const out: string[] = [];
  const pending = pendingWos(s).length;
  if (ref.kind === "challan" && pending)
    out.push(
      `${pending} Work ${pending === 1 ? "Order" : "Orders"} not sent yet. Continue?`,
    );
  if (ref.kind === "invoice" && !s.challan.sentAt)
    out.push("The Challan has not been sent yet. Continue?");
  if (ref.kind === "invoice" && !s.locked)
    out.push("Sending the Invoice locks this order.");
  if (date && date < ORDER.orderDate)
    out.push("Date is before the order date.");
  if (date && date > TODAY) out.push("Date is in the future.");
  return out;
}

const nowLabel = () =>
  "23 Oct 2026, " +
  new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

// Download / completed Share: store date, mark sent, clear Needs re-send, move status forward.
export function markSent(s: OrderState, ref: DocRef, date: string): OrderState {
  const sentAt = nowLabel();
  if (ref.kind === "wo") {
    const wos = s.wos.map((w) =>
      w.letter === ref.letter
        ? { ...w, status: "sent" as const, needsResend: false, date, sentAt }
        : w,
    );
    const next = { ...s, wos };
    const allSent = activeWos(next).every((w) => w.status === "sent");
    return {
      ...next,
      status: allSent ? forward(s.status, "wo_sent") : s.status,
    };
  }
  if (ref.kind === "challan")
    return {
      ...s,
      challan: { date, sentAt, needsResend: false },
      status: forward(s.status, "delivered"),
    };
  return {
    ...s,
    invoice: { date, sentAt, needsResend: false },
    status: forward(s.status, "invoiced"),
    locked: true,
  };
}

export function markSupplierTold(s: OrderState, letter: string): OrderState {
  return {
    ...s,
    wos: s.wos.map((w) =>
      w.letter === letter ? { ...w, supplierTold: true } : w,
    ),
  };
}

export function unlock(s: OrderState): OrderState {
  return { ...s, locked: false };
}

export const tk = (n: number) =>
  `Tk ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pcs = (n: number) => `${n.toLocaleString("en-IN")} pcs`;

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export function fileName(ref: DocRef, s: OrderState) {
  if (ref.kind === "wo") {
    const w = s.wos.find((x) => x.letter === ref.letter)!;
    return `${docNumber(ref)}_${w.supplier.split(" ")[0]}.pdf`;
  }
  return `${docNumber(ref)}_Highway-Sweets.pdf`;
}
