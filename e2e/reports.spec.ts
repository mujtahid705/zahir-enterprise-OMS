import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { addOrder } from "./support/orders";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// Reports (SPEC §10, issue #18). Records are new each run and burn real
// order numbers; E2E runs before go-live only (ADR 0002).

test("shows a report for a date range, exports it as CSV, and keeps Staff out", async ({
  page,
  browser,
}, testInfo) => {
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const customer = `Highway Sweets ${run}`;
  const supplier = `Suzinas ${run}`;
  const product = `Bread poly packet ${run}`;
  const customerUrl = await addCustomer(page, customer);
  await addSupplier(page, supplier);
  await addProduct(page, customerUrl, {
    name: product,
    supplier,
    // Priced high so it sorts to the first page among other runs' Orders.
    sell: "900.00",
    buy: "720.00",
  });
  await addOrder(page, customer, [product]);

  await page.goto("/reports");
  await page
    .getByRole("navigation", { name: "Reports" })
    .getByRole("link", { name: "By customer" })
    .click();
  await expect(page).toHaveURL(/report=customers/);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(new Date());
  await page.getByRole("textbox", { name: "Ordered From" }).fill(today);
  await page.getByRole("textbox", { name: "Ordered To" }).fill(today);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`from=${today}&to=${today}`));

  const row = page.getByRole("row").filter({ hasText: customer });
  await expect(row).toContainText("Tk 45,00,000.00");
  await expect(row).toContainText("Tk 9,00,000.00");
  await expect(row).toContainText("20%");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(
    `ze-customers-${today}-to-${today}.csv`,
  );
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("Customer,Orders,Sell total,Margin,Margin %\r\n");
  expect(csv).toContain(`${customer},1,4500000.00,900000.00,20\r\n`);

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await expect(
    staff.getByRole("link", { name: "Reports", exact: true }),
  ).toHaveCount(0);
  await staff.goto("/reports");
  await expect(staff.getByText("doesn't have access")).toBeVisible();
  const exported = await staff.request.get("/reports/export?report=customers");
  expect(exported.status()).toBe(403);
  await staff.context().close();
});
