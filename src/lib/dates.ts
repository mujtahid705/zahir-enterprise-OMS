import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Dates in ZE's timezone, Asia/Dhaka (SPEC §9).

export const TIMEZONE = "Asia/Dhaka";

// Today's calendar date in Dhaka as YYYY-MM-DD, the shape of a date column.
export function todayInDhaka(now: Date = new Date()): string {
  return format(new TZDate(now, TIMEZONE), "yyyy-MM-dd");
}

// A date column (YYYY-MM-DD) as shown in the app: "16 Oct 2026".
export function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return format(new Date(year!, month! - 1, day), "d MMM yyyy");
}
