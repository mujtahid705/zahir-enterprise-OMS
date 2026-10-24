import { expect, test, type Browser, type Page } from "@playwright/test";
import { activityAfter, eventsAfter, lastActivityId } from "./support/activity";
import { e2ePassword, projectUser } from "./support/users";

// Phase 1 done-when (SPEC §15): the Admin creates a Manager and a Staff User,
// each sees only what §3 allows, and it's all in the Activity Log.
// These Users are new each run (marked @test.ze, ADR 0002).

const TEMP_PASSWORD = "temporary-pass-1";

async function addUser(
  page: Page,
  user: { name: string; email: string; role: string },
) {
  await page.goto("/settings/users/new");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page
    .getByLabel("Role", { exact: true })
    .selectOption({ label: user.role });
  await page.getByLabel("Temporary password").fill(TEMP_PASSWORD);
  await page.getByRole("button", { name: "Add User" }).click();
  await expect(page.getByRole("heading", { name: user.name })).toBeVisible();
}

async function signInAs(browser: Browser, email: string, password: string) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  return page;
}

async function sidebarLabels(page: Page) {
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
  return nav.getByRole("link").allInnerTexts();
}

test("Admin creates a Manager and a Staff, each sees only their sections", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  const run = Date.now();
  const manager = {
    name: `Manager ${run}`,
    email: `manager-${run}@test.ze`,
    role: "Manager",
  };
  const staff = {
    name: `Staff ${run}`,
    email: `staff-${run}@test.ze`,
    role: "Staff",
  };
  const before = await lastActivityId();

  await addUser(page, manager);
  await addUser(page, staff);

  const managerPage = await signInAs(browser, manager.email, TEMP_PASSWORD);
  expect(await sidebarLabels(managerPage)).toEqual([
    "Dashboard",
    "Orders",
    "Products",
    "Customers",
    "Suppliers",
    "Reports",
  ]);
  await managerPage.goto("/settings/users");
  await expect(
    managerPage.getByRole("heading", { name: "No access" }),
  ).toBeVisible();

  const staffPage = await signInAs(browser, staff.email, TEMP_PASSWORD);
  expect(await sidebarLabels(staffPage)).toEqual([
    "Dashboard",
    "Orders",
    "Products",
    "Customers",
    "Suppliers",
  ]);
  for (const path of ["/activity", "/reports", "/settings/users"]) {
    await staffPage.goto(path);
    await expect(
      staffPage.getByRole("heading", { name: "No access" }),
    ).toBeVisible();
  }

  const log = await activityAfter(before);
  expect(log).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "insert",
        entityLabel: manager.name,
        userName: "Test Admin",
      }),
      expect.objectContaining({
        action: "insert",
        entityLabel: staff.name,
        userName: "Test Admin",
      }),
    ]),
  );
});

test("Admin changes a role, deactivates and reactivates a User", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  const run = Date.now();
  const user = {
    name: `Changing ${run}`,
    email: `changing-${run}@test.ze`,
    role: "Staff",
  };
  await addUser(page, user);

  await page
    .getByLabel("Role", { exact: true })
    .selectOption({ label: "Manager" });
  await page.getByRole("button", { name: "Save role" }).click();
  await page.getByRole("button", { name: "Change role" }).click();
  await expect(page.getByText("Role saved.")).toBeVisible();
  await expect(page.getByText(`${user.email} · Manager`)).toBeVisible();

  await page.getByRole("button", { name: "Deactivate User" }).click();
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page.getByText("Deactivated", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reactivate User" }).click();
  await expect(page.getByText("Deactivated", { exact: true })).toBeHidden();

  await page.goto("/settings/users");
  await page.getByRole("searchbox", { name: "Search Users" }).fill(user.email);
  await page.getByRole("searchbox", { name: "Search Users" }).press("Enter");
  await expect(page.getByRole("link", { name: user.name })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2);
});

test("any User changes their own name and password", async ({
  browser,
}, testInfo) => {
  const user = projectUser("account", testInfo.project.name);
  const page = await signInAs(browser, user.email, e2ePassword());
  const before = await lastActivityId();

  await page.goto("/account");
  await page
    .getByLabel("Name", { exact: true })
    .fill(`${user.fullName} renamed`);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Name saved.")).toBeVisible();

  await page.getByLabel("Current password").fill("wrong-password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("brand-new-pass-1");
  await page.getByLabel("Confirm new password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password is wrong.")).toBeVisible();

  await page.getByLabel("Current password").fill(e2ePassword());
  await page
    .getByLabel("New password", { exact: true })
    .fill("brand-new-pass-1");
  await page.getByLabel("Confirm new password").fill("brand-new-pass-1");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  expect(
    await eventsAfter(before, { userName: `${user.fullName} renamed` }),
  ).toContain("password_change");
});
