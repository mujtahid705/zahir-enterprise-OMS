import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// A native <select> styled like Input: right for short fixed lists (roles)
// and the phone's own picker.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-input bg-surface pr-9 pl-3 text-base outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 lg:h-9 lg:text-sm",
          className,
        )}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
        strokeWidth={1.5}
      />
    </div>
  );
}

export { NativeSelect };
