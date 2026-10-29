import Link from "next/link";
import { cn } from "@/lib/utils";
import { ActivityEntries } from "@/components/activity/activity-entries";
import { Pager } from "@/components/pager";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  ACTIVITY_PAGE_SIZE,
  activity,
  type HistoryScope,
} from "@/services/activity";

// A record's History tab (SPEC §9): its Activity Log entries, for Admins.
export async function RecordHistory({
  actor,
  scope,
  page,
  pageHref,
}: {
  actor: CurrentUser;
  scope: HistoryScope;
  page: number;
  pageHref: (page: number) => string;
}) {
  const { days, total } = await activity.list(actor, { page }, { scope });
  if (total === 0)
    return (
      <p className="text-sm text-ink-muted">Nothing recorded for this yet.</p>
    );
  return (
    <div className="flex flex-col gap-4">
      <ActivityEntries days={days} />
      <Pager
        page={page}
        pages={Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE))}
        total={total}
        noun="entries"
        href={pageHref}
      />
    </div>
  );
}

// The tabs over a record detail page; History only for Admins (SPEC §9).
export function RecordTabs<T extends string>({
  label,
  tabs,
  current,
  href,
}: {
  label: string;
  tabs: readonly { value: T; label: string }[];
  current: T;
  href: (value: T) => string;
}) {
  return (
    <nav
      aria-label={`${label} sections`}
      className="flex gap-6 border-b border-border text-sm"
    >
      {tabs.map(({ value, label: text }) => (
        <Link
          key={value}
          href={href(value)}
          aria-current={value === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 pb-2",
            value === current
              ? "border-navy font-medium text-navy"
              : "border-transparent text-ink-muted hover:text-navy",
          )}
        >
          {text}
        </Link>
      ))}
    </nav>
  );
}

// Which tab a detail page shows: History only if asked for and allowed.
export function historyTab(
  actor: CurrentUser,
  params: Record<string, string | string[] | undefined>,
): { history: boolean; page: number } {
  const history =
    params.tab === "history" && can(actor.role, "viewActivityLog");
  return { history, page: Math.max(1, Number(params.page) || 1) };
}
