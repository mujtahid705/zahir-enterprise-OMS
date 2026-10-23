"use client";

// PROTOTYPE ONLY: pieces shared by the dashboard variants.

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MONTHS,
  NEEDS_ACTION,
  RECENT,
  STATUS_LABEL,
  THIS_MONTH,
  lakh,
  tk,
  type ActionGroup,
  type Status,
} from "./data";

export type Role = "admin" | "manager" | "staff";
export type VariantProps = { role: Role };
export const seesMoney = (r: Role) => r !== "staff";

const PILL: Record<Status, string> = {
  created: "bg-[var(--status-created-bg)] text-[var(--status-created-fg)]",
  wo_sent: "bg-[var(--status-wo-sent-bg)] text-[var(--status-wo-sent-fg)]",
  delivered:
    "bg-[var(--status-delivered-bg)] text-[var(--status-delivered-fg)]",
  invoiced: "bg-[var(--status-invoiced-bg)] text-[var(--status-invoiced-fg)]",
  completed:
    "bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]",
  cancelled:
    "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-fg)]",
};

export function StatusPill({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        PILL[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const statusHref = (s: Status) => `/orders?status=${s}`;

export function Card({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <h2 className="section-label">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ---------- This month ---------- */

export function MonthFigures({
  role,
  layout = "row",
}: {
  role: Role;
  layout?: "row" | "stack";
}) {
  const margin = THIS_MONTH.sell - THIS_MONTH.buy;
  const items = [
    {
      label: "Orders",
      value: THIS_MONTH.orders.toLocaleString("en-IN"),
      cls: "text-navy",
    },
    { label: "Sell total", value: tk(THIS_MONTH.sell, 0), cls: "text-navy" },
    ...(seesMoney(role)
      ? [
          {
            label: "Buy total",
            value: tk(THIS_MONTH.buy, 0),
            cls: "text-navy",
          },
          {
            label: "Margin",
            value: tk(margin, 0),
            sub: `${((margin / THIS_MONTH.sell) * 100).toFixed(1)}% of sell`,
            cls: "text-brass",
          },
        ]
      : []),
  ];
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border bg-border",
        layout === "row" ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2",
        !seesMoney(role) && layout === "row" && "lg:grid-cols-2",
      )}
    >
      {items.map((i) => (
        <div key={i.label} className="bg-surface px-4 py-4 md:px-5">
          <p className="section-label">{i.label}</p>
          <p
            className={cn(
              "mt-1 font-semibold num",
              layout === "row"
                ? "text-2xl md:text-[30px] md:leading-9"
                : "text-xl",
              i.cls,
            )}
          >
            {i.value}
          </p>
          {"sub" in i && i.sub && (
            <p className="mt-0.5 text-xs text-ink-muted num">{i.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- 6-month chart (DESIGN.md §7). Admin/Manager only. ---------- */

const SELL = "var(--navy)";
const BUY = "#CBD5E1";
const BUY_EDGE = "#94A3B8";
const MARGIN = "var(--brass)";

export function SixMonthChart({ height = 220 }: { height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  // Draw at the real pixel width so text and marks keep their size at any card width.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(280, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);
  const H = height;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const max =
    Math.ceil(Math.max(...MONTHS.map((m) => m.sell)) / 2_00_000) * 2_00_000;
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const colW = (W - pad.l - pad.r) / MONTHS.length;
  const barW = Math.min(18, colW / 4);
  const cx = (i: number) => pad.l + colW * i + colW / 2;
  const marginPts = MONTHS.map((m, i) => [cx(i), y(m.sell - m.buy)] as const);
  const last = MONTHS.length - 1;

  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4 md:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <Legend
          swatch={
            <span
              className="size-2.5 rounded-sm"
              style={{ background: SELL }}
            />
          }
          label="Sell"
        />
        <Legend
          swatch={
            <span
              className="size-2.5 rounded-sm border"
              style={{ background: BUY, borderColor: BUY_EDGE }}
            />
          }
          label="Buy"
        />
        <Legend
          swatch={
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: MARGIN }}
            />
          }
          label="Margin"
        />
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          className="ml-auto text-navy underline-offset-4 hover:underline"
        >
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {asTable ? (
        <table className="w-full text-sm num">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="py-1.5 font-medium">Month</th>
              <th className="py-1.5 text-right font-medium">Sell</th>
              <th className="py-1.5 text-right font-medium">Buy</th>
              <th className="py-1.5 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.map((m) => (
              <tr key={m.m} className="border-t border-border">
                <td className="py-1.5">{m.m}</td>
                <td className="py-1.5 text-right">{tk(m.sell, 0)}</td>
                <td className="py-1.5 text-right">{tk(m.buy, 0)}</td>
                <td className="py-1.5 text-right">{tk(m.sell - m.buy, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div ref={boxRef} className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="block"
            role="img"
            aria-label="Sell, buy and margin, last 6 months"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--hairline)"
                  strokeWidth={1}
                />
                <text
                  x={pad.l - 6}
                  y={y(t) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--ink-subtle)"
                >
                  {t === 0 ? "0" : lakh(t)}
                </text>
              </g>
            ))}
            {MONTHS.map((m, i) => (
              <g key={m.m} opacity={hover === null || hover === i ? 1 : 0.45}>
                <rect
                  x={cx(i) - barW - 1}
                  y={y(m.sell)}
                  width={barW}
                  height={y(0) - y(m.sell)}
                  rx={3}
                  fill={SELL}
                />
                <rect
                  x={cx(i) + 1}
                  y={y(m.buy)}
                  width={barW}
                  height={y(0) - y(m.buy)}
                  rx={3}
                  fill={BUY}
                  stroke={BUY_EDGE}
                  strokeWidth={0.75}
                />
                <text
                  x={cx(i)}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--ink-muted)"
                >
                  {m.m}
                </text>
              </g>
            ))}
            <polyline
              points={marginPts.map((p) => p.join(",")).join(" ")}
              fill="none"
              stroke={MARGIN}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {marginPts.map(([px, py], i) => (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={hover === i ? 5 : 4}
                fill={MARGIN}
                stroke="white"
                strokeWidth={2}
              />
            ))}
            <text
              x={marginPts[last][0]}
              y={marginPts[last][1] - 10}
              textAnchor="middle"
              fontSize={10}
              fill="var(--ink-muted)"
            >
              {lakh(MONTHS[last].sell - MONTHS[last].buy)}
            </text>
            {MONTHS.map((m, i) => (
              <rect
                key={m.m}
                x={pad.l + colW * i}
                y={0}
                width={colW}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(i)}
              />
            ))}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-border bg-surface p-3 text-xs shadow-overlay"
              style={{
                left: `${(cx(hover) / W) * 100}%`,
                transform:
                  hover > 3
                    ? "translateX(calc(-100% - 12px))"
                    : "translateX(12px)",
              }}
            >
              <p className="mb-1.5 font-semibold text-ink">
                {MONTHS[hover].m} 2026
              </p>
              <TipRow
                color={SELL}
                label="Sell"
                value={tk(MONTHS[hover].sell, 0)}
              />
              <TipRow
                color={BUY}
                label="Buy"
                value={tk(MONTHS[hover].buy, 0)}
              />
              <TipRow
                color={MARGIN}
                label="Margin"
                value={tk(MONTHS[hover].sell - MONTHS[hover].buy, 0)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}

function TipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      <span className="size-2 rounded-sm" style={{ background: color }} />
      <span className="text-ink-muted">{label}</span>
      <span className="ml-auto text-ink num">{value}</span>
    </p>
  );
}

/* ---------- Needs action ---------- */

export const actionTotal = NEEDS_ACTION.reduce((n, g) => n + g.items.length, 0);

const TONE: Record<ActionGroup["tone"], string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  neutral: "bg-border-strong",
};

export function ActionGroupList({
  group,
  limit,
  showHint,
}: {
  group: ActionGroup;
  limit?: number;
  showHint?: boolean;
}) {
  const items = limit ? group.items.slice(0, limit) : group.items;
  return (
    <div>
      <div className="flex items-center gap-2 px-4 pt-3 md:px-5">
        <span className={cn("size-2 rounded-full", TONE[group.tone])} />
        <h3 className="text-sm font-medium text-ink">{group.title}</h3>
        <span className="rounded-full bg-canvas px-2 text-xs text-ink-muted num">
          {group.items.length}
        </span>
      </div>
      {showHint && (
        <p className="px-4 pl-8 text-xs text-ink-muted md:px-5 md:pl-9">
          {group.hint}
        </p>
      )}
      <ul className="mt-1">
        {items.map((it) => (
          <li key={it.no}>
            <Link
              href="/orders"
              className="flex items-center gap-3 px-4 py-2 hover:bg-canvas md:px-5"
            >
              <div className="min-w-0 flex-1 pl-4">
                <p className="truncate text-sm text-ink">
                  <span className="font-medium">{it.no}</span>{" "}
                  <span className="text-ink-muted">· {it.who}</span>
                </p>
                <p className="truncate text-xs text-ink-subtle">{it.detail}</p>
              </div>
              <span className="text-sm text-navy">{it.action} →</span>
            </Link>
          </li>
        ))}
        {limit && group.items.length > limit && (
          <li className="px-4 py-2 pl-8 text-xs text-ink-muted md:px-5 md:pl-9">
            +{group.items.length - limit} more
          </li>
        )}
      </ul>
    </div>
  );
}

/* ---------- Recent orders ---------- */

export function RecentOrders({ limit = 10 }: { limit?: number }) {
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="bg-canvas text-left section-label">
            <th className="px-5 py-2.5 font-semibold">Order</th>
            <th className="px-3 py-2.5 font-semibold">Customer</th>
            <th className="px-3 py-2.5 font-semibold">Date</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-5 py-2.5 text-right font-semibold">Sell</th>
          </tr>
        </thead>
        <tbody>
          {RECENT.slice(0, limit).map((o) => (
            <tr
              key={o.no}
              className="h-11 border-t border-border hover:bg-canvas"
            >
              <td className="px-5 font-medium text-ink">
                <Link href="/orders">{o.no}</Link>
              </td>
              <td className="px-3 text-ink">{o.customer}</td>
              <td className="px-3 text-ink-muted">{o.date}</td>
              <td className="px-3">
                <span className="flex items-center gap-2">
                  <StatusPill status={o.status} />
                  {o.woTotal !== undefined && (
                    <span className="text-xs text-ink-muted">
                      WO {o.woSent}/{o.woTotal}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-5 text-right text-ink num">{tk(o.sell)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border md:hidden">
        {RECENT.slice(0, limit).map((o) => (
          <li key={o.no}>
            <Link href="/orders" className="flex flex-col gap-1 px-4 py-3">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{o.no}</span>
                <StatusPill status={o.status} />
              </span>
              <span className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink-muted">{o.customer}</span>
                <span className="text-ink num">{tk(o.sell)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
