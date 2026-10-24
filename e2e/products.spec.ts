import { expect, test, type Page } from "@playwright/test";
import { activityAfter, lastActivityId } from "./support/activity";
import { addCustomer, addSupplier } from "./support/master-data";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// Products (SPEC §4.3, issue #8). Records are new each run and burn real
// codes; E2E runs before go-live only (ADR 0002).

function productsTab(page: Page) {
  return page
    .getByRole("navigation", { name: /sections$/ })
    .getByRole("link", { name: "products" });
}

// Pickers label options "<code> <name>"; pick by name.
async function pick(page: Page, picker: string, name: string) {
  const select = page.getByRole("combobox", { name: picker });
  const value = await select
    .locator("option", { hasText: name })
    .getAttribute("value");
  await select.selectOption(value!);
}

async function addProductFromCustomer(
  page: Page,
  customerUrl: string,
  { name, supplier }: { name: string; supplier: string },
) {
  await page.goto(customerUrl);
  await productsTab(page).click();
  await page.getByRole("link", { name: "Add Product" }).click();
  await pick(page, "Supplier", supplier);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Size" }).fill("10×14 in");
  await page.getByRole("textbox", { name: "Thickness" }).fill("40 micron");
  await page.getByRole("textbox", { name: /^Sell price/ }).fill("2.5");
  await page.getByRole("textbox", { name: /^Buy price/ }).fill("2");
  await page.getByRole("button", { name: "Add Product" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

test("Phase 2: Admin enters a Customer, a Supplier and their Product", async ({
  page,
}, testInfo) => {
  const run = `${Date.now()} ${testInfo.project.name}`;
  const customer = `Highway Sweets ${run}`;
  const otherCustomer = `Lucky Bakery ${run}`;
  const supplier = `Suzinas ${run}`;
  const product = `Bread poly packet ${run}`;
  const before = await lastActivityId();

  const customerUrl = await addCustomer(page, customer);
  await addCustomer(page, otherCustomer);
  const supplierUrl = await addSupplier(page, supplier);
  await addProductFromCustomer(page, customerUrl, { name: product, supplier });

  await expect(page.getByText(/^P-\d{4,}$/)).toBeVisible();
  await expect(page.getByRole("link", { name: customer })).toBeVisible();
  await expect(page.getByRole("link", { name: supplier })).toBeVisible();
  const prices = page.getByRole("definition");
  await expect(prices.getByText("Tk 2.50", { exact: true })).toBeVisible();
  await expect(prices.getByText("Tk 2.00", { exact: true })).toBeVisible();
  await expect(prices.getByText("Tk 0.50", { exact: true })).toBeVisible();
  await expect(prices.getByText("20%", { exact: true })).toBeVisible();

  // Price change applies from now on.
  await page.getByRole("link", { name: "Edit product" }).click();
  await page.getByRole("textbox", { name: /^Sell price/ }).fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(prices.getByText("Tk 3.00", { exact: true })).toBeVisible();
  await expect(prices.getByText("33.3%", { exact: true })).toBeVisible();

  await page
    .getByRole("link", { name: "Duplicate for another customer" })
    .click();
  await pick(page, "Customer", otherCustomer);
  await expect(page.getByRole("textbox", { name: /^Buy price/ })).toHaveValue(
    "2.00",
  );
  await page.getByRole("textbox", { name: /^Sell price/ }).fill("2.8");
  await page.getByRole("button", { name: "Duplicate Product" }).click();
  await expect(page.getByRole("link", { name: otherCustomer })).toBeVisible();
  await expect(prices.getByText("Tk 2.80", { exact: true })).toBeVisible();

  // The Supplier's read-only tab lists both, with their Customers.
  await page.goto(supplierUrl);
  await productsTab(page).click();
  await expect(page.getByRole("link", { name: product })).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Add Product" })).toBeHidden();

  // Product list filtered by Customer.
  await page.goto("/products");
  await pick(page, "Customer", customer);
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByRole("link", { name: product })).toHaveCount(1);

  const log = (await activityAfter(before)).filter((row) =>
    row.entityLabel?.endsWith(product),
  );
  expect(log.map((row) => row.action)).toEqual(["insert", "update", "insert"]);
});

test("Staff see Product prices but never margin", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  const run = String(Date.now());
  const customer = `Sweet Corner ${run}`;
  const supplier = `Rahim Plastics ${run}`;
  const product = `Sweet box 1 kg ${run}`;
  const customerUrl = await addCustomer(page, customer);
  await addSupplier(page, supplier);
  const productUrl = await addProductFromCustomer(page, customerUrl, {
    name: product,
    supplier,
  });

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto(productUrl);
  await expect(staff.getByRole("heading", { name: product })).toBeVisible();
  await expect(staff.getByText("Tk 2.50", { exact: true })).toBeVisible();
  await expect(staff.getByText("Tk 2.00", { exact: true })).toBeVisible();
  await expect(staff.getByText(/Margin/)).toHaveCount(0);
  await expect(staff.getByRole("link", { name: "Edit product" })).toBeHidden();
  await expect(
    staff.getByRole("link", { name: "Duplicate for another customer" }),
  ).toBeHidden();

  await staff.goto(customerUrl);
  await productsTab(staff).click();
  await expect(staff.getByRole("link", { name: product })).toBeVisible();
  await expect(staff.getByText(/Margin/)).toHaveCount(0);
  await expect(staff.getByRole("link", { name: "Add Product" })).toBeHidden();

  for (const path of [
    "/products/new",
    `${new URL(productUrl).pathname}/edit`,
    `${new URL(productUrl).pathname}/duplicate`,
  ]) {
    await staff.goto(path);
    await expect(
      staff.getByRole("heading", { name: "No access" }),
    ).toBeVisible();
  }
});
