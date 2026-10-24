import { cn } from "@/lib/utils";

// DESIGN.md §1: neutral outline badge.
export function DeactivatedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border-strong px-2 py-0.5 text-xs text-ink-muted",
        className,
      )}
    >
      Deactivated
    </span>
  );
}
