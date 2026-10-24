"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Ellipsis, Plus } from "lucide-react";
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
  type Role,
} from "@/lib/nav";

const tabClass =
  "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium";

// Phone navigation below 768px: Dashboard · Orders · + New Order · Products · More.
// The bar stays mounted while the User streams in; only `moreItems` (role
// dependent) arrives later, so a tap on More is never lost.
export function BottomTabBar({ moreItems }: { moreItems: ReactNode }) {
  const pathname = usePathname();

  const [dashboard, orders, products] = PHONE_TAB_HREFS.map((href) =>
    NAV_ITEMS.find((item) => item.href === href)!,
  );
  // Everything outside the tabs (New Order sits under Orders) is under More.
  const moreActive = !PHONE_TAB_HREFS.some((href) => isActive(pathname, href));

  const tab = (item: (typeof NAV_ITEMS)[number]) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(tabClass, active ? "text-navy" : "text-ink-subtle")}
      >
        <Icon className="size-[22px]" strokeWidth={1.5} />
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
        {tab(dashboard)}
        {tab(orders)}
        <div className="flex flex-1 justify-center">
          <Link
            href="/orders/new"
            aria-label="New Order"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-navy text-white shadow-overlay ring-4 ring-surface"
          >
            <Plus className="size-6" strokeWidth={2} />
          </Link>
        </div>
        {tab(products)}
        <Sheet>
          <SheetTrigger
            className={cn(
              tabClass,
              moreActive ? "text-navy" : "text-ink-subtle",
            )}
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
            {moreItems}
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

// The More sheet's links for a role: what the tabs don't show, plus Account.
export function MoreItems({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = [
    ...navItemsFor(role).filter(
      (item) => !(PHONE_TAB_HREFS as readonly string[]).includes(item.href),
    ),
    ACCOUNT_ITEM,
  ];

  return (
    <ul className="px-2">
      {items.map(({ href, label, icon: Icon }) => (
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
  );
}
