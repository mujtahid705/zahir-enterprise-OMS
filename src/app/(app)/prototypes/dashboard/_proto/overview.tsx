"use client";

// PROTOTYPE variant "Overview": numbers first. Status tiles, month figures, chart, then lists.

import Link from "next/link";
import { COUNTS, NEEDS_ACTION, STATUS_LABEL, type Status } from "./data";
import {
  ActionGroupList,
  Card,
  MonthFigures,
  RecentOrders,
  SixMonthChart,
  actionTotal,
  seesMoney,
  statusHref,
  type VariantProps,
} from "./shared";

const ORDER: Status[] = [
  "created",
  "wo_sent",
  "delivered",
  "invoiced",
  "completed",
  "cancelled",
];
const DOT: Record<Status, string> = {
  created: "var(--status-created-fg)",
  wo_sent: "var(--status-wo-sent-fg)",
  delivered: "var(--status-delivered-fg)",
  invoiced: "var(--status-invoiced-fg)",
  completed: "var(--status-completed-fg)",
  cancelled: "var(--status-cancelled-fg)",
};

export function Overview({ role }: VariantProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="section-label">Orders by status</h2>
        <ul className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-6">
          {ORDER.map((s) => (
            <li key={s}>
              <Link
                href={statusHref(s)}
                className="flex h-full flex-col gap-1 bg-surface px-4 py-3 hover:bg-canvas"
              >
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: DOT[s] }}
                  />
                  {STATUS_LABEL[s]}
                </span>
                <span className="text-2xl font-semibold text-navy num">
                  {COUNTS[s]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-label">October 2026</h2>
        <MonthFigures role={role} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {seesMoney(role) && (
          <Card title="Last 6 months" className="self-start lg:col-span-3">
            <SixMonthChart />
          </Card>
        )}
        <Card
          title={`Needs action · ${actionTotal}`}
          className={seesMoney(role) ? "lg:col-span-2" : "lg:col-span-5"}
        >
          <div className="divide-y divide-border pb-2">
            {NEEDS_ACTION.map((g) => (
              <ActionGroupList key={g.id} group={g} limit={2} />
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Last 10 orders"
        action={
          <Link href="/orders" className="text-sm text-navy">
            View all
          </Link>
        }
      >
        <RecentOrders />
      </Card>
    </div>
  );
}
