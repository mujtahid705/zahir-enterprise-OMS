// PROTOTYPE ONLY: sample dashboard data for 23 Oct 2026.

export type Status =
  "created" | "wo_sent" | "delivered" | "invoiced" | "completed" | "cancelled";

export type Order = {
  no: string;
  customer: string;
  date: string; // display
  status: Status;
  sell: number;
  woSent?: number;
  woTotal?: number;
  flag?: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  created: "Created",
  wo_sent: "WO Sent",
  delivered: "Delivered",
  invoiced: "Invoiced",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const COUNTS: Record<Status, number> = {
  created: 4,
  wo_sent: 3,
  delivered: 2,
  invoiced: 5,
  completed: 61,
  cancelled: 2,
};

export const RECENT: Order[] = [
  {
    no: "ORD-2026-0077",
    customer: "Fresh Bake Ltd",
    date: "23 Oct",
    status: "created",
    sell: 31_860,
    woSent: 0,
    woTotal: 2,
  },
  {
    no: "ORD-2026-0076",
    customer: "Highway Sweets",
    date: "23 Oct",
    status: "created",
    sell: 44_000,
    woSent: 1,
    woTotal: 2,
  },
  {
    no: "ORD-2026-0075",
    customer: "Mithai Ghor",
    date: "22 Oct",
    status: "wo_sent",
    sell: 18_720,
  },
  {
    no: "ORD-2026-0074",
    customer: "Bonoful Confectionery",
    date: "22 Oct",
    status: "delivered",
    sell: 62_400,
    flag: "Challan needs re-send",
  },
  {
    no: "ORD-2026-0073",
    customer: "Highway Sweets",
    date: "21 Oct",
    status: "invoiced",
    sell: 27_350,
  },
  {
    no: "ORD-2026-0072",
    customer: "Rongdhonu Bakery",
    date: "20 Oct",
    status: "wo_sent",
    sell: 9_850,
  },
  {
    no: "ORD-2026-0071",
    customer: "Fresh Bake Ltd",
    date: "19 Oct",
    status: "invoiced",
    sell: 51_200,
  },
  {
    no: "ORD-2026-0070",
    customer: "Mithai Ghor",
    date: "18 Oct",
    status: "delivered",
    sell: 23_900,
  },
  {
    no: "ORD-2026-0069",
    customer: "Bonoful Confectionery",
    date: "17 Oct",
    status: "completed",
    sell: 38_400,
  },
  {
    no: "ORD-2026-0068",
    customer: "Highway Sweets",
    date: "16 Oct",
    status: "cancelled",
    sell: 12_600,
  },
];

export type ActionGroup = {
  id: string;
  title: string;
  hint: string;
  tone: "warning" | "danger" | "neutral";
  items: { no: string; who: string; detail: string; action: string }[];
};

export const NEEDS_ACTION: ActionGroup[] = [
  {
    id: "cancelled-wo",
    title: "Cancelled WOs to tell supplier",
    hint: "Supplier still thinks they should produce these.",
    tone: "danger",
    items: [
      {
        no: "WO-2026-0074-B",
        who: "Rahim Plastics",
        detail: "Cancelled 22 Oct",
        action: "Open order",
      },
    ],
  },
  {
    id: "resend",
    title: "Needs re-send",
    hint: "Order changed after the document was sent.",
    tone: "warning",
    items: [
      {
        no: "WO-2026-0074-A",
        who: "Suzinas Poly Industries",
        detail: "Work Order",
        action: "Re-send",
      },
      {
        no: "CH-2026-0074",
        who: "Bonoful Confectionery",
        detail: "Challan",
        action: "Re-send",
      },
    ],
  },
  {
    id: "pending-wo",
    title: "Work Orders not sent",
    hint: "Suppliers can't start until they get these.",
    tone: "neutral",
    items: [
      {
        no: "WO-2026-0077-A",
        who: "Suzinas Poly Industries",
        detail: "ORD-2026-0077 · Fresh Bake Ltd",
        action: "Send",
      },
      {
        no: "WO-2026-0077-B",
        who: "Dhaka Box & Carton",
        detail: "ORD-2026-0077 · Fresh Bake Ltd",
        action: "Send",
      },
      {
        no: "WO-2026-0076-B",
        who: "Rahim Plastics",
        detail: "ORD-2026-0076 · Highway Sweets",
        action: "Send",
      },
    ],
  },
  {
    id: "to-invoice",
    title: "Delivered, not invoiced",
    hint: "Send the Invoice to get paid.",
    tone: "neutral",
    items: [
      {
        no: "ORD-2026-0074",
        who: "Bonoful Confectionery",
        detail: "Delivered 22 Oct",
        action: "Invoice",
      },
      {
        no: "ORD-2026-0070",
        who: "Mithai Ghor",
        detail: "Delivered 19 Oct",
        action: "Invoice",
      },
    ],
  },
  {
    id: "to-complete",
    title: "Invoiced, not completed",
    hint: "Mark Completed once everyone is paid.",
    tone: "neutral",
    items: [
      {
        no: "ORD-2026-0073",
        who: "Highway Sweets",
        detail: "Invoiced 21 Oct · 2 days",
        action: "Open",
      },
      {
        no: "ORD-2026-0071",
        who: "Fresh Bake Ltd",
        detail: "Invoiced 19 Oct · 4 days",
        action: "Open",
      },
      {
        no: "ORD-2026-0066",
        who: "Rongdhonu Bakery",
        detail: "Invoiced 9 Oct · 14 days",
        action: "Open",
      },
      {
        no: "ORD-2026-0064",
        who: "Mithai Ghor",
        detail: "Invoiced 6 Oct · 17 days",
        action: "Open",
      },
      {
        no: "ORD-2026-0061",
        who: "Highway Sweets",
        detail: "Invoiced 1 Oct · 22 days",
        action: "Open",
      },
    ],
  },
];

export const THIS_MONTH = { orders: 23, sell: 7_84_350, buy: 6_05_910 };

export const MONTHS = [
  { m: "May", sell: 5_12_400, buy: 3_98_700 },
  { m: "Jun", sell: 6_08_900, buy: 4_71_300 },
  { m: "Jul", sell: 5_76_200, buy: 4_49_800 },
  { m: "Aug", sell: 7_22_500, buy: 5_58_100 },
  { m: "Sep", sell: 8_14_700, buy: 6_31_900 },
  { m: "Oct", sell: 7_84_350, buy: 6_05_910 },
];

export const tk = (n: number, dp = 2) =>
  `Tk ${n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

// Compact lakh notation for chart axes: 7.8L
export const lakh = (n: number) =>
  `${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1)}L`;
