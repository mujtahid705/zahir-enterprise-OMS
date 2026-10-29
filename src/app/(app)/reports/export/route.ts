import { requireRole } from "@/lib/auth";
import { todayInDhaka } from "@/lib/dates";
import { PERMISSIONS } from "@/lib/permissions";
import { REPORTS, reportCsv, reportFilters } from "@/lib/reports";
import { reports } from "@/services/reports";

// A report as a CSV file (SPEC §10), for the same report and order date
// range as the page. Route handlers skip the layout's RoleGate, so the
// role is checked here as well as in the service.
export async function GET(request: Request) {
  const actor = await requireRole(...PERMISSIONS.viewReports);
  const filters = reportFilters(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const { rows } = await reports.run(actor, filters);
  const range = `${filters.from ?? "start"}-to-${filters.to ?? todayInDhaka()}`;

  return new Response(reportCsv(REPORTS[filters.report].columns, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ze-${filters.report}-${range}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
