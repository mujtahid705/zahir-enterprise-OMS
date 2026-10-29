import { expect, type Page } from "@playwright/test";

// Saves an Order through the Steps form with 5,000 pcs of each Product and
// returns its number without the prefix, e.g. "2026-0012".
export async function addOrder(
  page: Page,
  customer: string,
  products: readonly string[],
): Promise<string> {
  await page.goto("/orders/new");
  await page
    .getByRole("searchbox", { name: "Search customers" })
    .fill(customer);
  await page.getByRole("button", { name: new RegExp(customer) }).click();
  for (const [index, product] of products.entries()) {
    await page
      .getByRole("button", {
        name: index ? "Add another product" : "Add product",
      })
      .click();
    await page
      .getByRole("dialog", { name: "Add product" })
      .getByRole("button", { name: new RegExp(product) })
      .click();
    const qty = page.getByRole("dialog", { name: product });
    await qty.getByRole("button", { name: "5,000", exact: true }).click();
    await qty.getByRole("button", { name: "Add to order" }).click();
  }
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save order" }).click();

  const orderNo = page.getByRole("heading", { name: /^ORD-\d{4}-\d{4,}$/ });
  await expect(orderNo).toBeVisible();
  return (await orderNo.textContent())!.slice("ORD-".length);
}
