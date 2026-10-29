import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { formatDay, type ActivityEntry } from "@/lib/activity-log";
import { TIMEZONE } from "@/lib/dates";

// Activity Log entries grouped by Dhaka day (SPEC §11.2): a day header with
// its count, then one line per save that opens to its field diffs and event
// details. Shared by /activity and the History tabs.

export type ActivityDay = {
  day: string;
  count: number;
  entries: ActivityEntry[];
};

export function ActivityEntries({ days }: { days: ActivityDay[] }) {
  return (
    <div className="flex flex-col gap-6">
      {days.map(({ day, count, entries }) => (
        <section
          key={day}
          aria-labelledby={`day-${day}`}
          className="flex flex-col gap-2"
        >
          <h3 id={`day-${day}`} className="section-label">
            {formatDay(day)} — {count} {count === 1 ? "change" : "changes"}
          </h3>
          <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {entries.map((entry) => (
              <li key={entry.txId}>
                <Entry entry={entry} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Entry({ entry }: { entry: ActivityEntry }) {
  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-canvas md:grid-cols-[5.5rem_16rem_8rem_1fr] md:items-baseline [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1 text-xs whitespace-nowrap text-ink-muted num md:text-sm">
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
            strokeWidth={1.5}
          />
          {format(new TZDate(entry.occurredAt, TIMEZONE), "h:mm a")}
        </span>
        <span className="truncate text-xs text-ink-muted md:text-sm md:text-ink">
          {entry.userName} · <span className="md:hidden">{entry.action}</span>
          <span className="hidden md:inline">{entry.record}</span>
        </span>
        <span className="hidden text-sm text-ink-muted md:inline">
          {entry.action}
        </span>
        <span className="col-span-2 text-sm text-ink md:col-span-1">
          {entry.summary}
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-border bg-canvas px-4 py-3">
        {entry.details.map((detail) => (
          <div key={detail.id} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-ink">{detail.title}</p>
            {detail.fields.length > 0 && (
              <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 text-xs">
                {detail.fields.map((field) => (
                  <div key={field.label} className="contents">
                    <dt className="text-ink-muted">{field.label}</dt>
                    <dd className="break-words text-ink">
                      {field.from !== undefined && (
                        <span
                          className={
                            field.to !== undefined
                              ? "text-ink-muted line-through"
                              : undefined
                          }
                        >
                          {field.from}
                        </span>
                      )}
                      {field.from !== undefined &&
                        field.to !== undefined &&
                        " → "}
                      {field.to}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
