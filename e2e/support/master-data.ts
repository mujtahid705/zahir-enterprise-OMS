import { expect, type Page } from "@playwright/test";

// Adds master data through the forms and returns the detail page URL.
// Fields are found by role, not label: Next keeps the page just left mounted
// but hidden, and getByLabel would also match its form.

export async function addCustomer(page: Page, name: string) {
  await page.goto("/customers/new");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Phone" }).fill("01711000000");
  await page
    .getByRole("textbox", { name: "Address" })
    .fill("12 Station Road, Dhaka");
  await page.getByRole("button", { name: "Add Customer" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

export async function addSupplier(page: Page, name: string) {
  await page.goto("/suppliers/new");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Phone" }).fill("01811000000");
  await page.getByRole("textbox", { name: "WhatsApp" }).fill("01811000000");
  await page
    .getByRole("textbox", { name: "Address" })
    .fill("Plot 4, Tongi BSCIC");
  await page.getByRole("button", { name: "Add Supplier" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url();
}

// Adds a Product for the Customer whose detail page is `customerUrl`.
export async function addProduct(
  page: Page,
  customerUrl: string,
  product: { name: string; supplier: string; sell: string; buy: string },
) {
  const customerId = new URL(customerUrl).pathname.split("/").pop();
  await page.goto(`/products/new?customer=${customerId}`);
  const supplier = page.getByRole("combobox", { name: "Supplier" });
  const value = await supplier
    .locator("option", { hasText: product.supplier })
    .getAttribute("value");
  await supplier.selectOption(value!);
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(product.name);
  await page.getByRole("textbox", { name: /^Sell price/ }).fill(product.sell);
  await page.getByRole("textbox", { name: /^Buy price/ }).fill(product.buy);
  await page.getByRole("button", { name: "Add Product" }).click();
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
}
