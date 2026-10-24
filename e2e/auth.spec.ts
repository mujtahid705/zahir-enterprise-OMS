import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { requireEnv } from "../scripts/seed-users.mts";
import { eventsAfter, lastActivityId } from "./support/activity";
import { E2E_USERS, e2ePassword, projectUser } from "./support/users";

// These specs start signed out.
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Next's route announcer is also role="alert", so match the form's by text.
function formAlert(page: Page, text: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text });
}

async function openUserMenu(page: Page) {
  await page
    .getByRole("button", { name: /Account menu for/ })
    .filter({ visible: true })
    .click();
}

test("signed-out visitors are sent to sign in", async ({ page }) => {
  for (const path of ["/", "/orders/new", "/settings", "/reset-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/login");
  }
});

test("signs in and shows the User's name and role", async ({ page }) => {
  const admin = E2E_USERS.admin;
  const before = await lastActivityId();

  await signIn(page, admin.email, e2ePassword());

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await openUserMenu(page);
  await expect(page.getByRole("menu")).toContainText("Test Admin");
  await expect(page.getByRole("menu")).toContainText("Admin");
  expect(await eventsAfter(before, { userName: admin.fullName })).toContain(
    "login",
  );
});

test("wrong password shows an error and is logged", async ({ page }) => {
  const before = await lastActivityId();

  await signIn(page, E2E_USERS.admin.email, "not-the-password");

  await expect(formAlert(page, "Wrong email or password.")).toBeVisible();
  await expect(page).toHaveURL("/login");
  expect(await eventsAfter(before, { email: E2E_USERS.admin.email })).toContain(
    "login_failed",
  );
});

test("a deactivated User cannot sign in", async ({ page }) => {
  await signIn(page, E2E_USERS.deactivated.email, e2ePassword());

  await expect(
    formAlert(page, "This account is deactivated. Ask an Admin."),
  ).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

test("log out from the user menu ends the session", async ({
  page,
}, testInfo) => {
  const user = projectUser("logout", testInfo.project.name);
  await signIn(page, user.email, e2ePassword());
  await expect(page).toHaveURL("/");
  const before = await lastActivityId();

  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Log out" }).click();

  await expect(page).toHaveURL("/login");
  await page.goto("/orders");
  await expect(page).toHaveURL("/login");
  expect(await eventsAfter(before, { userName: user.fullName })).toContain(
    "logout",
  );
});

test("a reset link lets the User set a new password", async ({
  page,
}, testInfo) => {
  const user = projectUser("reset", testInfo.project.name);
  // The same link the reset email carries, without sending an email.
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
  });
  expect(error).toBeNull();
  const before = await lastActivityId();

  await page.goto(
    `/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery&next=/reset-password`,
  );
  await expect(page).toHaveURL("/reset-password");
  const newPassword = `${e2ePassword()}-new`;
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Save password" }).click();

  await expect(page).toHaveURL("/");
  expect(await eventsAfter(before, { userName: user.fullName })).toContain(
    "password_reset",
  );
});

test("a used or bad reset link asks for a new one", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=recovery");

  await expect(page).toHaveURL("/forgot-password?expired=1");
  await expect(formAlert(page, "expired")).toBeVisible();
});
