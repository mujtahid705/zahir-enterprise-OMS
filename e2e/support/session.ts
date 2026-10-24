import { expect, type Browser } from "@playwright/test";

// A fresh desktop session for another User, alongside the Admin's.
export async function signInAs(
  browser: Browser,
  email: string,
  password: string,
) {
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
