"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Plus } from "lucide-react";
import { LinkPending } from "@/components/link-pending";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_ITEM,
  NAV_ITEMS,
  PHONE_TAB_HREFS,
  isActive,
  navItemsFor,
} from "@/lib/nav";
import type { Role } from "@/lib/permissions";

const tabClass =
  "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium";

const [DASHBOARD, ORDERS, PRODUCTS] = PHONE_TAB_HREFS.map((href) =>
  NAV_ITEMS.find((item) => item.href === href)!,
);

// Phone navigation below 768px: Dashboard · Orders · + New Order · Products · More.
// Reads the pathname and the User's role, so it renders inside <Suspense>
// with BottomTabBarFallback.
export function BottomTabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const moreItems = [
    ...navItemsFor(role).filter(
      (item) => !(PHONE_TAB_HREFS as readonly string[]).includes(item.href),
    ),
    ACCOUNT_ITEM,
  ];
  // Everything outside the tabs (New Order sits under Orders) is under More.
  const moreActive = !PHONE_TAB_HREFS.some((href) => isActive(pathname, href));

  return (
    <TabBar pathname={pathname}>
      <Sheet>
        <SheetTrigger
          className={cn(tabClass, moreActive ? "text-navy" : "text-ink-subtle")}
        >
          <Ellipsis className="size-[22px]" strokeWidth={1.5} />
          More
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="gap-2 rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+16px)]"
        >
          <SheetHeader className="pb-0">
            <SheetTitle className="section-label">More</SheetTitle>
          </SheetHeader>
          <ul className="px-2">
            {moreItems.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <SheetClose asChild>
                  <Link
                    href={href}
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className="flex h-12 items-center gap-3 rounded-lg px-3 text-base text-ink aria-[current=page]:bg-canvas aria-[current=page]:font-medium"
                  >
                    <Icon className="size-5 text-ink-muted" strokeWidth={1.5} />
                    {label}
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </TabBar>
  );
}

// Prerendered stand-in: same bar, nothing highlighted, More not yet usable.
export function BottomTabBarFallback() {
  return (
    <TabBar pathname={null}>
      <button
        type="button"
        disabled
        className={cn(tabClass, "text-ink-subtle")}
      >
        <Ellipsis className="size-[22px]" strokeWidth={1.5} />
        More
      </button>
    </TabBar>
  );
}

function TabBar({
  pathname,
  children,
}: {
  pathname: string | null;
  children: React.ReactNode;
}) {
  const tab = (item: (typeof NAV_ITEMS)[number]) => {
    const active = pathname !== null && isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(tabClass, active ? "text-navy" : "text-ink-subtle")}
      >
        <LinkPending>
          <Icon className="size-[22px]" strokeWidth={1.5} />
        </LinkPending>
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex items-end">
        {tab(DASHBOARD)}
        {tab(ORDERS)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/orders/new"
            aria-label="New Order"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-navy text-white shadow-overlay ring-4 ring-surface"
          >
            <LinkPending>
              <Plus className="size-6" strokeWidth={2} />
            </LinkPending>
          </Link>
        </div>
        {tab(PRODUCTS)}
        {children}
      </div>
    </nav>
  );
}
