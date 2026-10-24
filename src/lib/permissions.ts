// Who may do what: SPEC §3, plus Reports from §9. The server checks these in
// every action and page (requireRole); the UI only mirrors them.

export type Role = "admin" | "manager" | "staff";

export const ROLES: readonly Role[] = ["admin", "manager", "staff"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

const ALL = ROLES;
const ADMIN_MANAGER: readonly Role[] = ["admin", "manager"];
const ADMIN: readonly Role[] = ["admin"];

export const PERMISSIONS = {
  manageUsers: ADMIN,
  editCompanySettings: ADMIN,
  viewActivityLog: ADMIN,
  manageMasterData: ADMIN_MANAGER,
  addProductInline: ADMIN_MANAGER,
  editOrders: ALL,
  overridePrices: ADMIN_MANAGER,
  shareDocuments: ALL,
  // Staff may move forward, but not to Completed or Cancelled.
  changeStatusForward: ALL,
  changeStatusBackward: ADMIN_MANAGER,
  completeOrCancel: ADMIN_MANAGER,
  seeMargin: ADMIN_MANAGER,
  viewReports: ADMIN_MANAGER,
  unlockOrder: ADMIN,
  // Only if never used in an order.
  deleteMasterData: ADMIN,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}
