"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActive, navItemsFor } from "@/lib/nav";
import type { Role } from "@/lib/permissions";

// Desktop and tablet navigation. 72px icons-only below 1280px, 248px from 1280px.
// The nav reads the pathname and the User's role, so it renders inside
// <Suspense> with SidebarFallback (the frame without items).
export function Sidebar({ role }: { role: Role }) {
  return (
    <SidebarFrame>
      <SidebarNav role={role} />
    </SidebarFrame>
  );
}

export function SidebarFallback() {
  return <SidebarFrame />;
}

function SidebarFrame({ children }: { children?: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex xl:w-[248px]">
      <Link
        href="/"
        className="flex h-16 items-center gap-3 px-6 xl:px-5"
        aria-label="Zahir Enterprise, dashboard"
      >
        <Image
          src="/brand/ze-mark-white.svg"
          alt=""
          width={34}
          height={20}
          priority
          className="shrink-0"
        />
        <span className="hidden section-label text-white xl:inline">
          Zahir Enterprise
        </span>
      </Link>
      {children}
    </aside>
  );
}

function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav className="mt-2 flex flex-col gap-0.5 px-3" aria-label="Main">
      {navItemsFor(role).map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "relative flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150 xl:justify-start",
              active
                ? "bg-sidebar-accent text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-brass"
                : "hover:bg-navy-hover hover:text-white",
            )}
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.5} />
            <span className="hidden xl:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
