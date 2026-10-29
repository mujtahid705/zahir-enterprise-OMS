// Dashboard (SPEC §10, DESIGN.md §7): pure rules for the 6-month chart.

// The `count` months up to and including today's (YYYY-MM-DD), oldest
// first, as YYYY-MM.
export function lastMonths(today: string, count = 6): string[] {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year!, month! - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

const STEPS = [1, 2, 2.5, 5, 10];

// The y-axis: four even steps of 1, 2, 2.5 or 5 at some power of ten,
// enough to reach the biggest value. One lakh when everything is zero.
export function chartScale(values: readonly number[]): {
  max: number;
  ticks: number[];
} {
  const raw = Math.max(...values, 0) / 4 || 25_000;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = STEPS.find((s) => s * power >= raw)! * power;
  return { max: step * 4, ticks: [0, 1, 2, 3, 4].map((i) => step * i) };
}

// Compact lakh for the chart: "7.5L", "12L", "0.25L".
export function formatLakh(amount: number): string {
  if (amount === 0) return "0";
  const lakh = amount / 1_00_000;
  const digits = lakh < 1 ? 2 : lakh < 10 ? 1 : 0;
  return `${Number(lakh.toFixed(digits))}L`;
}

// Items shown per Needs action group before "+N more" (DESIGN.md §7).
export const NEEDS_ACTION_SHOWN = 2;
