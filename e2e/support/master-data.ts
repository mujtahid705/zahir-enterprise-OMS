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
