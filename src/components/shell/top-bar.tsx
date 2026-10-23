import Image from "next/image";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PLACEHOLDER_USER } from "@/components/shell/placeholder-user";
import { UserMenu } from "@/components/shell/user-menu";

// Page header. Navy with the white mark on phones, white from 768px.
export function TopBar({ title }: { title: string }) {
  const user = PLACEHOLDER_USER;
  return (
    <header className="sticky top-0 z-30 border-b border-sidebar-border bg-navy pt-[env(safe-area-inset-top)] md:border-border md:bg-surface md:pt-0">
      <div className="flex h-14 items-center gap-3 px-4 md:h-16 md:px-8">
        <Image
          src="/brand/ze-mark-white.svg"
          alt=""
          width={30}
          height={18}
          className="md:hidden"
        />
        <h1 className="flex-1 truncate text-base font-semibold text-white md:text-2xl md:text-navy">
          {title}
        </h1>
        {/* Global search: wired up with the orders list. */}
        <div className="relative hidden w-72 lg:block">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle"
            strokeWidth={1.5}
          />
          <Input
            type="search"
            placeholder="Search orders, customers…"
            aria-label="Search"
            className="pl-9"
          />
        </div>
        <span className="md:hidden">
          <UserMenu user={user} tone="navy" />
        </span>
        <span className="hidden md:inline-flex">
          <UserMenu user={user} />
        </span>
      </div>
    </header>
  );
}
