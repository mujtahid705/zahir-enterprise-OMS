"use client";

// PROTOTYPE variant "Pipeline": open orders as a board, one column per status.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { COUNTS, STATUS_LABEL, tk, type Status } from "./data";
import {
  Card,
  MonthFigures,
  SixMonthChart,
  actionTotal,
  seesMoney,
  statusHref,
  type VariantProps,
} from "./shared";

type Mini = {
  no: string;
  customer: string;
  sell: number;
  age: string;
  flag?: { text: string; tone: "warning" | "danger" | "neutral" };
};

const BOARD: Record<"created" | "wo_sent" | "delivered" | "invoiced", Mini[]> =
  {
    created: [
      {
        no: "ORD-2026-0077",
        customer: "Fresh Bake Ltd",
        sell: 31_860,
        age: "Today",
        flag: { text: "WO 0/2", tone: "neutral" },
      },
      {
        no: "ORD-2026-0076",
        customer: "Highway Sweets",
        sell: 44_000,
        age: "Today",
        flag: { text: "WO 1/2", tone: "neutral" },
      },
      {
        no: "ORD-2026-0067",
        customer: "Rongdhonu Bakery",
        sell: 15_300,
        age: "6 days",
        flag: { text: "WO 0/1", tone: "neutral" },
      },
      {
        no: "ORD-2026-0065",
        customer: "Mithai Ghor",
        sell: 8_950,
        age: "9 days",
        flag: { text: "WO 0/1", tone: "neutral" },
      },
    ],
    wo_sent: [
      {
        no: "ORD-2026-0075",
        customer: "Mithai Ghor",
        sell: 18_720,
        age: "1 day",
      },
      {
        no: "ORD-2026-0072",
        customer: "Rongdhonu Bakery",
        sell: 9_850,
        age: "3 days",
      },
      {
        no: "ORD-2026-0063",
        customer: "Bonoful Confectionery",
        sell: 22_100,
        age: "5 days",
      },
    ],
    delivered: [
      {
        no: "ORD-2026-0074",
        customer: "Bonoful Confectionery",
        sell: 62_400,
        age: "1 day",
        flag: { text: "Needs re-send", tone: "warning" },
      },
      {
        no: "ORD-2026-0070",
        customer: "Mithai Ghor",
        sell: 23_900,
        age: "4 days",
      },
    ],
    invoiced: [
      {
        no: "ORD-2026-0073",
        customer: "Highway Sweets",
        sell: 27_350,
        age: "2 days",
      },
      {
        no: "ORD-2026-0071",
        customer: "Fresh Bake Ltd",
        sell: 51_200,
        age: "4 days",
      },
      {
        no: "ORD-2026-0066",
        customer: "Rongdhonu Bakery",
        sell: 19_800,
        age: "14 days",
      },
      {
        no: "ORD-2026-0064",
        customer: "Mithai Ghor",
        sell: 33_450,
        age: "17 days",
      },
      {
        no: "ORD-2026-0061",
        customer: "Highway Sweets",
        sell: 41_000,
        age: "22 days",
        flag: { text: "Unpaid 22 days", tone: "danger" },
      },
    ],
  };

const COLS = ["created", "wo_sent", "delivered", "invoiced"] as const;
const NEXT: Record<(typeof COLS)[number], string> = {
  created: "Send WOs",
  wo_sent: "Send Challan",
  delivered: "Send Invoice",
  invoiced: "Mark completed",
};
const BAR: Record<Status, string> = {
  created: "var(--status-created-fg)",
  wo_sent: "var(--status-wo-sent-fg)",
  delivered: "var(--status-delivered-fg)",
  invoiced: "var(--status-invoiced-fg)",
  completed: "var(--status-completed-fg)",
  cancelled: "var(--status-cancelled-fg)",
};

export function Pipeline({ role }: VariantProps) {
  return (
    <div className="flex flex-col gap-6">
      <MonthFigures role={role} />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="section-label">
            Open orders · {actionTotal} need action
          </h2>
          <span className="text-xs text-ink-muted">
            <Link href={statusHref("completed")} className="hover:text-navy">
              {COUNTS.completed} completed
            </Link>
            {" · "}
            <Link href={statusHref("cancelled")} className="hover:text-navy">
              {COUNTS.cancelled} cancelled
            </Link>
          </span>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {COLS.map((s) => (
            <section
              key={s}
              className="flex w-[78%] shrink-0 snap-start flex-col rounded-xl bg-[color-mix(in_oklab,var(--hairline)_45%,var(--canvas))] p-2 md:w-auto"
            >
              <Link
                href={statusHref(s)}
                className="flex items-center justify-between px-2 pt-1 pb-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span
                    className="h-3.5 w-1 rounded-full"
                    style={{ background: BAR[s] }}
                  />
                  {STATUS_LABEL[s]}
                </span>
                <span className="text-sm text-ink-muted num">{COUNTS[s]}</span>
              </Link>
              <ul className="flex flex-col gap-2">
                {BOARD[s].map((o) => (
                  <li key={o.no}>
                    <Link
                      href="/orders"
                      className="block rounded-lg border border-border bg-surface p-3 hover:border-border-strong"
                    >
                      <p className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-ink">{o.no}</span>
                        <span className="text-xs text-ink-subtle">{o.age}</span>
                      </p>
                      <p className="truncate text-sm text-ink-muted">
                        {o.customer}
                      </p>
                      <p className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm text-ink num">
                          {tk(o.sell, 0)}
                        </span>
                        {o.flag && (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                              o.flag.tone === "warning" &&
                                "border border-warning text-warning",
                              o.flag.tone === "danger" &&
                                "bg-[var(--status-cancelled-bg)] text-danger",
                              o.flag.tone === "neutral" &&
                                "bg-canvas text-ink-muted",
                            )}
                          >
                            {o.flag.text}
                          </span>
                        )}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="px-2 pt-2 text-xs text-ink-subtle">
                Next: {NEXT[s]}
              </p>
            </section>
          ))}
        </div>
      </section>

      {seesMoney(role) && (
        <Card title="Last 6 months">
          <SixMonthChart />
        </Card>
      )}
    </div>
  );
}
