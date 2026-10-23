"use client";

// PROTOTYPE variant "To-do": the work queue leads; figures live in a side rail.

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { COUNTS, NEEDS_ACTION, STATUS_LABEL, type Status } from "./data";
import {
  ActionGroupList,
  Card,
  MonthFigures,
  RecentOrders,
  SixMonthChart,
  StatusPill,
  actionTotal,
  seesMoney,
  statusHref,
  type VariantProps,
} from "./shared";

const OPEN: Status[] = ["created", "wo_sent", "delivered", "invoiced"];

export function Todo({ role }: VariantProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-2xl font-semibold text-navy">
            {actionTotal} things need you today
          </p>
          <p className="mt-1 text-ink-muted">
            Most urgent first. Each one opens the order.
          </p>
        </div>
        <Card title="Needs action">
          {actionTotal ? (
            <div className="divide-y divide-border pb-2">
              {NEEDS_ACTION.map((g) => (
                <ActionGroupList key={g.id} group={g} showHint />
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 px-5 py-8 text-ink-muted">
              <CircleCheck className="size-5 text-success" /> Nothing waiting.
              All documents are sent.
            </p>
          )}
        </Card>
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

      <aside className="flex flex-col gap-6">
        <Card title="Open orders">
          <ul className="divide-y divide-border">
            {OPEN.map((s) => (
              <li key={s}>
                <Link
                  href={statusHref(s)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-canvas md:px-5"
                >
                  <StatusPill status={s} />
                  <span className="font-semibold text-navy num">
                    {COUNTS[s]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-border px-4 py-2.5 text-xs text-ink-muted md:px-5">
            <Link href={statusHref("completed")} className="hover:text-navy">
              {COUNTS.completed} {STATUS_LABEL.completed}
            </Link>
            {" · "}
            <Link href={statusHref("cancelled")} className="hover:text-navy">
              {COUNTS.cancelled} {STATUS_LABEL.cancelled}
            </Link>
          </p>
        </Card>
        <section className="flex flex-col gap-3">
          <h2 className="section-label">October 2026</h2>
          <MonthFigures role={role} layout="stack" />
        </section>
        {seesMoney(role) && (
          <Card title="Last 6 months">
            <SixMonthChart height={200} />
          </Card>
        )}
      </aside>
    </div>
  );
}
