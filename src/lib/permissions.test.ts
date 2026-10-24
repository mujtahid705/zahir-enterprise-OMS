import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, type Permission } from "@/lib/permissions";

// Expected values transcribed from the SPEC §3 table (plus Reports from §9).
const ALLOWED: Record<"admin" | "manager" | "staff", Permission[]> = {
  admin: Object.keys(PERMISSIONS) as Permission[],
  manager: [
    "manageMasterData",
    "addProductInline",
    "editOrders",
    "overridePrices",
    "shareDocuments",
    "changeStatusForward",
    "changeStatusBackward",
    "completeOrCancel",
    "seeMargin",
    "viewReports",
  ],
  staff: ["editOrders", "shareDocuments", "changeStatusForward"],
};

describe("can", () => {
  for (const role of ["admin", "manager", "staff"] as const) {
    it(`gives ${role} exactly the SPEC §3 permissions`, () => {
      const granted = (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
        can(role, p),
      );
      expect(granted.sort()).toEqual([...ALLOWED[role]].sort());
    });
  }

  it("keeps the Admin-only powers to Admins", () => {
    for (const p of [
      "manageUsers",
      "editCompanySettings",
      "viewActivityLog",
      "unlockOrder",
      "deleteMasterData",
    ] as const) {
      expect(can("admin", p)).toBe(true);
      expect(can("manager", p)).toBe(false);
      expect(can("staff", p)).toBe(false);
    }
  });

  it("covers every row of the SPEC §3 table plus Reports", () => {
    expect(Object.keys(PERMISSIONS)).toHaveLength(15);
  });
});
