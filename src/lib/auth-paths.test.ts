import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "@/lib/auth-paths";

describe("isPublicPath", () => {
  it("lets signed-out visitors reach sign-in and password recovery", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
  });

  it("keeps every app route behind sign-in", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/orders/new")).toBe(false);
    expect(isPublicPath("/reset-password")).toBe(false);
    expect(isPublicPath("/login-as-admin")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a same-site path", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/orders?status=created")).toBe(
      "/orders?status=created",
    );
  });

  it("falls back to the dashboard for anything off-site or missing", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("reset-password")).toBe("/");
  });

  it("refuses control characters the URL parser would strip", () => {
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
  });
});
