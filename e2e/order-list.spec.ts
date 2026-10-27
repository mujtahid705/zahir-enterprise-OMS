import { expect, test } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// The Order list (SPEC §9 /orders, issue #11). Records are new each run and
// burn real order numbers; E2E runs before go-live only (ADR 0002).

test("finds an Order by search and filters kept in the URL, and Staff see no Margin", async ({
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
    sell: "2.50",
    buy: "2.00",
  });

  await page.goto("/orders/new");
  await page
    .getByRole("searchbox", { name: "Search customers" })
    .fill(customer);
  await page.getByRole("button", { name: new RegExp(customer) }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await page
    .getByRole("dialog", { name: "Add product" })
    .getByRole("button", { name: new RegExp(product) })
    .click();
  const qty = page.getByRole("dialog", { name: product });
  await qty.getByRole("button", { name: "500", exact: true }).click();
  await qty.getByRole("button", { name: "Add to order" }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderNo = (await page
    .getByRole("heading", { name: /^ORD-\d{4}-\d{4,}$/ })
    .textContent())!;

  await page.goto("/orders");
  await page.getByRole("searchbox", { name: "Search Orders" }).fill(run);
  await page.getByRole("combobox", { name: "Status" }).selectOption("created");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/status=created/);
  const rows = page.getByRole("row").filter({ hasText: orderNo });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText(customer);
  await expect(rows).toContainText("Created");
  await expect(rows).toContainText("Tk 1,250.00");
  await expect(rows).toContainText("Tk 250.00 (20%)");

  // A dashboard tile links straight to a status.
  await page.goto(`/orders?status=delivered&q=${encodeURIComponent(run)}`);
  await expect(page.getByText("No orders match")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveValue(
    "delivered",
  );

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto(`/orders?q=${encodeURIComponent(orderNo)}`);
  const staffRow = staff.getByRole("row").filter({ hasText: orderNo });
  await expect(staffRow).toContainText("Tk 1,250.00");
  await expect(staff.getByText(/Margin/)).toHaveCount(0);
  await staff.context().close();
});
