"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { logout } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/nav";

export type ShellUser = { name: string; role: Role };
export type Tone = "light" | "navy";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function UserMenu({
  user,
  tone = "light",
}: {
  user: ShellUser;
  tone?: Tone;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex size-9 items-center justify-center rounded-full text-xs font-semibold",
          tone === "navy"
            ? "bg-white/10 text-white"
            : "border border-border-strong bg-surface text-navy",
        )}
        aria-label={`Account menu for ${user.name}`}
      >
        {initials(user.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">{user.name}</span>
          <span className="text-xs font-normal text-ink-muted">
            {ROLE_LABEL[user.role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound strokeWidth={1.5} />
            Account
          </Link>
        </DropdownMenuItem>
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut strokeWidth={1.5} />
              Log out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
