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

export type Role = "admin" | "manager" | "staff";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
};

const ALL: readonly Role[] = ["admin", "manager", "staff"];

// Sidebar order. Role access per SPEC §3 and §9.
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/orders", label: "Orders", icon: ClipboardList, roles: ALL },
  { href: "/products", label: "Products", icon: Package, roles: ALL },
  { href: "/customers", label: "Customers", icon: Store, roles: ALL },
  { href: "/suppliers", label: "Suppliers", icon: Factory, roles: ALL },
  {
    href: "/reports",
    label: "Reports",
    icon: ChartColumn,
    roles: ["admin", "manager"],
  },
  { href: "/activity", label: "Activity", icon: History, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

// Reached from the user menu (desktop) and More (phone), not the sidebar.
export const ACCOUNT_ITEM: NavItem = {
  href: "/account",
  label: "Account",
  icon: UserRound,
  roles: ALL,
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
