import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { ActivityEntries } from "@/components/activity/activity-entries";
import { EmptyState } from "@/components/empty-state";
import { Pager } from "@/components/pager";
import { TopBar } from "@/components/shell/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  ACTION_TYPES,
  RECORD_TYPES,
  activityFilters,
  activityHref,
} from "@/lib/activity-log";
import { requireRole } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ACTIVITY_PAGE_SIZE, activity } from "@/services/activity";

export const metadata: Metadata = { title: "Activity" };

// The Activity Log (SPEC §11.2): every save, newest first, grouped by day,
// with filters kept in the URL and a CSV export of what they match.
export default function Page({ searchParams }: PageProps<"/activity">) {
  return (
    <>
      <TopBar title="Activity" />
      <main className="flex-1 p-4 md:p-8">
        <Suspense>
          <ActivityLog searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function ActivityLog({
  searchParams,
}: Pick<PageProps<"/activity">, "searchParams">) {
  const actor = await requireRole(...PERMISSIONS.viewActivityLog);
  const filters = activityFilters(await searchParams);
  const [{ days, total }, users] = await Promise.all([
    activity.list(actor, filters),
    activity.userOptions(actor),
  ]);
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const filtered = activityHref({ ...filters, page: 1 }) !== "/activity";

  if (total === 0 && !filtered) return <EmptyState message="No activity yet" />;

  return (
    <section className="flex max-w-6xl flex-col gap-4">
      <form
        role="search"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[2fr_repeat(3,minmax(8.5rem,1fr))_auto_auto_auto]"
      >
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Label htmlFor="q" className="sr-only">
            Search records
          </Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.query}
            placeholder="Search number, code or name"
          />
        </div>
        <Label htmlFor="user" className="sr-only">
          User
        </Label>
        <NativeSelect id="user" name="user" defaultValue={filters.userId ?? ""}>
          <option value="">All users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </NativeSelect>
        <Label htmlFor="record" className="sr-only">
          Record type
        </Label>
        <NativeSelect
          id="record"
          name="record"
          defaultValue={filters.recordType ?? ""}
        >
          <option value="">All records</option>
          {Object.entries(RECORD_TYPES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Label htmlFor="action" className="sr-only">
          Action type
        </Label>
        <NativeSelect
          id="action"
          name="action"
          defaultValue={filters.actionType ?? ""}
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_TYPES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <div className="flex items-center gap-2">
          <Label htmlFor="from" className="text-xs text-ink-muted">
            From
          </Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="to" className="text-xs text-ink-muted">
            To
          </Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {filtered && (
          <Link
            href="/activity"
            className="text-sm text-ink-muted hover:text-navy"
          >
            Clear filters
          </Link>
        )}
        {total > 0 && (
          <Button asChild variant="outline">
            <a
              href={activityHref(
                { ...filters, page: 1 },
                "/api/activity/export",
              )}
              download
            >
              <Download strokeWidth={1.5} />
              Export CSV
            </a>
          </Button>
        )}
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-ink-muted">
          {filters.query
            ? `No activity matches “${filters.query}”.`
            : "No activity matches these filters."}
        </p>
      ) : (
        <ActivityEntries days={days} />
      )}

      <Pager
        page={filters.page}
        pages={pages}
        total={total}
        noun="entries"
        href={(page) => activityHref({ ...filters, page })}
      />
    </section>
  );
}
