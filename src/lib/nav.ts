import {
  ChartColumn,
  ClipboardList,
  Factory,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { PERMISSIONS, ROLES, type Role } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
};

// Sidebar order. Role access comes from the permission matrix (SPEC §3, §9).
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ROLES },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ROLES },
  { href: "/products", label: "Products", icon: Package, roles: ROLES },
  { href: "/customers", label: "Customers", icon: Store, roles: ROLES },
  { href: "/suppliers", label: "Suppliers", icon: Factory, roles: ROLES },
  {
    href: "/reports",
    label: "Reports",
    icon: ChartColumn,
    roles: PERMISSIONS.viewReports,
  },
  {
    href: "/activity",
    label: "Activity",
    icon: History,
    roles: PERMISSIONS.viewActivityLog,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    roles: PERMISSIONS.manageUsers,
  },
];

// Reached from the user menu (desktop) and More (phone), not the sidebar.
export const ACCOUNT_ITEM: NavItem = {
  href: "/account",
  label: "Account",
  icon: UserRound,
  roles: ROLES,
};

// Phone bottom bar: Dashboard · Orders · + New Order · Products · More.
export const PHONE_TAB_HREFS = ["/", "/orders", "/products"] as const;

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
