"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Inside a <Link>: swaps its icon or label for a spinner while the page it
// opens is on the way. Both stay mounted, so nothing shifts; the swap waits
// 100ms so fast navigations don't flash.
export function LinkPending({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex transition-opacity",
          pending && "opacity-0 delay-100",
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity",
          pending && "opacity-100 delay-100",
        )}
      >
        <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
      </span>
    </span>
  );
}
