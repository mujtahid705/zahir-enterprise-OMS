import { cn } from "@/lib/utils";

// Stand-ins shown while a page's data streams in (DESIGN.md §8: skeleton
// shimmer while loading). They sit in the prerendered shell, so a click
// shows one at once instead of a blank page.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-table-head", className)}
    />
  );
}

// Announces the wait once for screen readers; the shapes are aria-hidden.
function Loading({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="hidden h-10 bg-table-head md:block" />
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 md:h-11 md:py-0"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// A filtered list or report: filter bar, then a table.
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Loading className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="hidden h-9 w-32 sm:block" />
        <Skeleton className="hidden h-9 w-32 sm:block" />
      </div>
      <Rows count={rows} />
    </Loading>
  );
}

// One record: heading, a strip of figures, then its details.
export function DetailSkeleton() {
  return (
    <Loading className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
      <Rows count={4} />
    </Loading>
  );
}

// A form in a card: label and field pairs, then the button.
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <Loading className="flex max-w-3xl flex-col gap-5 rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-28" />
    </Loading>
  );
}

// The Overview: figures, chart beside Needs action, then recent Orders.
export function DashboardSkeleton() {
  return (
    <Loading className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-surface px-4 py-3">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
      <Rows count={5} />
    </Loading>
  );
}
