import type { NextRequest } from "next/server";
import { activityFilters, entriesCsv } from "@/lib/activity-log";
import { requireRole } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { PERMISSIONS } from "@/lib/permissions";
import { activity } from "@/services/activity";

// The Activity Log's CSV export (SPEC §11.2): every entry the screen's
// filters match, unpaged. Takes the screen's own query string.
export async function GET(request: NextRequest) {
  const actor = await requireRole(...PERMISSIONS.viewActivityLog);
  const filters = activityFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const entries = await activity.all(actor, filters);
  return new Response(entriesCsv(entries), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-${todayInDhaka()}.csv"`,
    },
  });
}
