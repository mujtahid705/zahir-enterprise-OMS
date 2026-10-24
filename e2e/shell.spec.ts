import { expect, test } from "@playwright/test";

test("login screen shows the brand and sign-in form", async ({ browser }) => {
  const page = await browser.newPage({
    storageState: { cookies: [], origins: [] },
  });
  await page.goto("/login");
  await expect(
    page.getByRole("img", { name: "Zahir Enterprise" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("app shell navigates between sections", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const nav = page
    .getByRole("navigation", { name: "Main" })
    .filter({ visible: true });
  await nav.getByRole("link", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

  if (isMobile) {
    await nav.getByRole("link", { name: "New Order" }).click();
    await expect(
      page.getByRole("heading", { name: "New Order" }),
    ).toBeVisible();
    await nav.getByRole("button", { name: "More" }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Customers" })
      .click();
  } else {
    await nav.getByRole("link", { name: "Customers" }).click();
  }
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
});
