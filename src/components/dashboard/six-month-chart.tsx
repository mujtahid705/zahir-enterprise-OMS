"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { chartScale, formatLakh } from "@/lib/dashboard";
import { formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { DashboardOverview } from "@/services/dashboard";

// DESIGN.md §7 "Last 6 months": navy sell bars, light buy bars with an
// edge, a brass margin line with the latest point labelled. Hover or tap a
// month for its figures; the table view lists the same numbers. Drawn at
// the card's real width so text keeps its size.

type Month = NonNullable<DashboardOverview["months"]>[number];

const SELL = "var(--navy)";
const BUY = "var(--chart-buy)";
const BUY_EDGE = "var(--chart-buy-edge)";
const MARGIN = "var(--brass)";

const HEIGHT = 220;
const PAD = { l: 40, r: 12, t: 16, b: 24 };

export function SixMonthChart({ months }: { months: Month[] }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="flex flex-col gap-3 px-4 pt-3 pb-4 md:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <Legend label="Sell">
          <span className="size-2.5 rounded-sm" style={{ background: SELL }} />
        </Legend>
        <Legend label="Buy">
          <span
            className="size-2.5 rounded-sm border"
            style={{ background: BUY, borderColor: BUY_EDGE }}
          />
        </Legend>
        <Legend label="Margin">
          <span
            className="h-0.5 w-3 rounded-full"
            style={{ background: MARGIN }}
          />
        </Legend>
        <button
          type="button"
          onClick={() => setAsTable((table) => !table)}
          className="ml-auto text-navy underline-offset-4 hover:underline"
        >
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {asTable ? <MonthTable months={months} /> : <Bars months={months} />}
    </div>
  );
}

function Legend({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      {children}
      {label}
    </span>
  );
}

const whole = (amount: string | number) => formatMoney(amount, { whole: true });

function MonthTable({ months }: { months: Month[] }) {
  return (
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
        {months.map((m) => (
          <tr key={m.month} className="border-t border-border">
            <td className="py-1.5">{formatMonth(m.month)}</td>
            <td className="py-1.5 text-right">{whole(m.sell)}</td>
            <td className="py-1.5 text-right">{whole(m.buy)}</td>
            <td className="py-1.5 text-right">{whole(m.margin)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bars({ months }: { months: Month[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry!.contentRect.width))),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const values = months.map((m) => ({
    sell: Number(m.sell),
    buy: Number(m.buy),
    margin: Number(m.margin),
  }));
  const { max, ticks } = chartScale(
    values.flatMap((v) => [v.sell, v.buy, v.margin]),
  );
  // A negative month sits on the axis rather than below the chart.
  const y = (v: number) =>
    PAD.t + (HEIGHT - PAD.t - PAD.b) * (1 - Math.max(v, 0) / max);
  const colW = (width - PAD.l - PAD.r) / months.length;
  const barW = Math.min(18, colW / 4);
  const cx = (i: number) => PAD.l + colW * i + colW / 2;
  const marginPoints = values.map((v, i) => [cx(i), y(v.margin)] as const);
  const last = months.length - 1;

  return (
    <div ref={boxRef} className="relative" onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        className="block"
        role="img"
        aria-label="Sell, buy and margin, last 6 months"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.l}
              x2={width - PAD.r}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
            <text
              x={PAD.l - 6}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--ink-subtle)"
            >
              {formatLakh(tick)}
            </text>
          </g>
        ))}
        {values.map((v, i) => (
          <g
            key={months[i]!.month}
            opacity={hover === null || hover === i ? 1 : 0.45}
          >
            <rect
              x={cx(i) - barW - 1}
              y={y(v.sell)}
              width={barW}
              height={y(0) - y(v.sell)}
              rx={3}
              fill={SELL}
            />
            <rect
              x={cx(i) + 1}
              y={y(v.buy)}
              width={barW}
              height={y(0) - y(v.buy)}
              rx={3}
              fill={BUY}
              stroke={BUY_EDGE}
              strokeWidth={0.75}
            />
            <text
              x={cx(i)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={11}
              fill="var(--ink-muted)"
            >
              {formatMonth(months[i]!.month, "MMM")}
            </text>
          </g>
        ))}
        <polyline
          points={marginPoints.map((point) => point.join(",")).join(" ")}
          fill="none"
          stroke={MARGIN}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {marginPoints.map(([px, py], i) => (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={hover === i ? 5 : 4}
            fill={MARGIN}
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
        <text
          x={marginPoints[last]![0]}
          y={marginPoints[last]![1] - 10}
          textAnchor="middle"
          fontSize={10}
          fill="var(--ink-muted)"
          stroke="var(--surface)"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {formatLakh(values[last]!.margin)}
        </text>
        {months.map((m, i) => (
          <rect
            key={m.month}
            x={PAD.l + colW * i}
            y={0}
            width={colW}
            height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            // On touch, tapping the same month again closes its tooltip.
            onClick={() => setHover((shown) => (shown === i ? null : i))}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-border bg-surface p-3 text-xs shadow-overlay"
          style={{
            left: `${(cx(hover) / width) * 100}%`,
            transform:
              hover >= months.length / 2
                ? "translateX(calc(-100% - 12px))"
                : "translateX(12px)",
          }}
        >
          <p className="mb-1.5 font-semibold text-ink">
            {formatMonth(months[hover]!.month)}
          </p>
          <TipRow
            color={SELL}
            label="Sell"
            value={whole(months[hover]!.sell)}
          />
          <TipRow color={BUY} label="Buy" value={whole(months[hover]!.buy)} />
          <TipRow
            color={MARGIN}
            label="Margin"
            value={whole(months[hover]!.margin)}
          />
        </div>
      )}
    </div>
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
