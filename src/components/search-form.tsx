"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Pending = createContext(false);

// A list's search and filters: a GET form that navigates within the app
// instead of reloading the page, leaving out empty fields. Without
// JavaScript it still submits natively.
export function SearchForm({
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "action" | "method" | "onSubmit">) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <form
      role="search"
      {...props}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams();
        for (const [name, value] of new FormData(event.currentTarget)) {
          if (typeof value === "string" && value !== "")
            params.append(name, value);
        }
        const query = params.toString();
        const path = window.location.pathname;
        startTransition(() => router.push(query ? `${path}?${query}` : path));
      }}
    >
      <Pending value={pending}>{children}</Pending>
    </form>
  );
}

// The form's submit button, spinning while the results load.
export function SearchSubmit({ children }: { children: React.ReactNode }) {
  const pending = use(Pending);
  return (
    <Button type="submit" variant="outline">
      {pending && <Loader2 className="animate-spin" strokeWidth={1.5} />}
      {children}
    </Button>
  );
}

// For a form with no button: a spinner inside the search field. The field's
// wrapper must be `relative`.
export function SearchPending() {
  const pending = use(Pending);
  return (
    <Loader2
      aria-hidden
      strokeWidth={1.5}
      className={cn(
        "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-muted opacity-0 transition-opacity",
        pending && "opacity-100 delay-100",
      )}
    />
  );
}
