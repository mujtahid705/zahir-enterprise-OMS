import { describe, expect, it } from "vitest";
import { isActive, navItemsFor } from "@/lib/nav";

describe("navItemsFor", () => {
  it("hides Reports, Activity and Settings from Staff", () => {
    const labels = navItemsFor("staff").map((item) => item.label);
    expect(labels).toEqual([
      "Dashboard",
      "Orders",
      "Products",
      "Customers",
      "Suppliers",
    ]);
  });

  it("shows Reports but not Activity or Settings to Managers", () => {
    const labels = navItemsFor("manager").map((item) => item.label);
    expect(labels).toContain("Reports");
    expect(labels).not.toContain("Activity");
    expect(labels).not.toContain("Settings");
  });

  it("shows everything to Admins", () => {
    expect(navItemsFor("admin").map((item) => item.label)).toContain(
      "Activity",
    );
  });
});

describe("isActive", () => {
  it("matches Dashboard only on the root path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/orders", "/")).toBe(false);
  });

  it("matches a section and its sub-pages but not lookalike paths", () => {
    expect(isActive("/orders/new", "/orders")).toBe(true);
    expect(isActive("/orders-archive", "/orders")).toBe(false);
  });
});
