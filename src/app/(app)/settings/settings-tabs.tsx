"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/users", label: "Users" },
  { href: "/settings/company", label: "Company" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
      className="mb-6 flex gap-6 border-b border-border"
    >
      {TABS.map(({ href, label }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors duration-150",
              active
                ? "border-navy text-navy"
                : "border-transparent text-ink-muted hover:text-navy",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
