import { expect, test, type Page } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// Create an Order (SPEC §5.2, issue #9). Records are new each run and burn
// real order numbers; E2E runs before go-live only (ADR 0002).

async function addItem(page: Page, product: string, quantity: string) {
  await page.getByRole("button", { name: /^Add (another )?product$/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add product" });
  await sheet.getByRole("button", { name: new RegExp(product) }).click();
  const qty = page.getByRole("dialog", { name: product });
  await qty.getByRole("button", { name: quantity, exact: true }).click();
  await qty.getByRole("button", { name: "Add to order" }).click();
  await expect(qty).toBeHidden();
}

test("Phase 3: a two-Supplier Order makes two Work Orders, and Staff see no Margin", async ({
  page,
  browser,
}, testInfo) => {
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const customer = `Highway Sweets ${run}`;
  const suzinas = `Suzinas ${run}`;
  const rahim = `Rahim Plastics ${run}`;

  const customerUrl = await addCustomer(page, customer);
  await addSupplier(page, suzinas);
  await addSupplier(page, rahim);
  await addProduct(page, customerUrl, {
    name: `Bread poly packet ${run}`,
    supplier: suzinas,
    sell: "2.50",
    buy: "2.00",
  });
  await addProduct(page, customerUrl, {
    name: `Carry bag large ${run}`,
    supplier: rahim,
    sell: "4.00",
    buy: "3.00",
  });
  await addProduct(page, customerUrl, {
    name: `Sweet box 1 kg ${run}`,
    supplier: suzinas,
    sell: "8.00",
    buy: "6.00",
  });

  await page.goto("/orders/new");
  await page
    .getByRole("searchbox", { name: "Search customers" })
    .fill(customer);
  await page.getByRole("button", { name: new RegExp(customer) }).click();

  await addItem(page, `Bread poly packet ${run}`, "5,000");
  await addItem(page, `Carry bag large ${run}`, "2,000");
  await addItem(page, `Sweet box 1 kg ${run}`, "1,000");

  // A Product already on the Order can't be picked again.
  await page.getByRole("button", { name: "Add another product" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Add product" })
      .getByRole("button", { name: new RegExp(`Bread poly packet ${run}`) }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Review", exact: true }).click();
  const wos = page.getByRole("main");
  await expect(wos.getByText(suzinas)).toBeVisible();
  await expect(wos.getByText("2 items · 6,000 pcs")).toBeVisible();
  await expect(wos.getByText(rahim)).toBeVisible();
  await expect(wos.getByText("Tk 6,500.00 · 22.8%")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Delivery address" }),
  ).toHaveValue("12 Station Road, Dhaka");
  await page.getByRole("button", { name: "Save order" }).click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderNo = page.getByRole("heading", { name: /^ORD-\d{4}-\d{4,}$/ });
  await expect(orderNo).toBeVisible();
  const number = (await orderNo.textContent())!.slice("ORD-".length);
  const workOrders = page.getByRole("list", { name: "Work Orders" });
  await expect(workOrders.getByRole("listitem")).toHaveCount(2);
  await expect(
    workOrders.getByRole("listitem", { name: `WO-${number}-A · ${suzinas}` }),
  ).toBeVisible();
  await expect(
    workOrders.getByRole("listitem", { name: `WO-${number}-B · ${rahim}` }),
  ).toBeVisible();
  const totals = page.getByRole("definition");
  await expect(totals.getByText("Tk 28,500.00", { exact: true })).toBeVisible();
  await expect(totals.getByText("Tk 22,000.00", { exact: true })).toBeVisible();
  await expect(totals.getByText("Tk 6,500.00", { exact: true })).toBeVisible();
  await expect(totals.getByText("22.8%", { exact: true })).toBeVisible();

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto(page.url());
  await expect(
    staff.getByRole("heading", { name: `ORD-${number}` }),
  ).toBeVisible();
  await expect(
    staff.getByText("Tk 28,500.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(staff.getByText(/Margin|Buy total/)).toHaveCount(0);
  await expect(staff.getByText("Tk 22,000.00")).toHaveCount(0);
  await staff.context().close();
});

test("changing the Customer asks first, then clears the items", async ({
  page,
}, testInfo) => {
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const first = `Lucky Bakery ${run}`;
  const second = `Mitali Sweets ${run}`;
  const supplier = `Suzinas ${run}`;
  const firstUrl = await addCustomer(page, first);
  await addCustomer(page, second);
  await addSupplier(page, supplier);
  await addProduct(page, firstUrl, {
    name: `Cake box ${run}`,
    supplier,
    sell: "5.00",
    buy: "4.00",
  });

  await page.goto("/orders/new");
  const search = page.getByRole("searchbox", { name: "Search customers" });
  await search.fill(run);
  await page.getByRole("button", { name: new RegExp(first) }).click();
  await addItem(page, `Cake box ${run}`, "500");

  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: new RegExp(second) }).click();
  const dialog = page.getByRole("alertdialog", { name: "Change customer?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page
    .getByRole("navigation", { name: "Steps" })
    .getByRole("button", { name: /Items/ })
    .click();
  await expect(page.getByText(`Cake box ${run}`)).toBeVisible();

  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("button", { name: new RegExp(second) }).click();
  await dialog.getByRole("button", { name: "Change and clear items" }).click();
  await expect(page.getByText("No items yet.")).toBeVisible();
  await expect(page.getByText(second)).toBeVisible();
});

test("an Admin adds a missing Product from the order form and gives the line its own price", async ({
  page,
}, testInfo) => {
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const customer = `Mitali Sweets ${run}`;
  const supplier = `Rahim Plastics ${run}`;
  const product = `Carry bag large ${run}`;
  await addCustomer(page, customer);
  await addSupplier(page, supplier);

  await page.goto("/orders/new");
  await page
    .getByRole("searchbox", { name: "Search customers" })
    .fill(customer);
  await page.getByRole("button", { name: new RegExp(customer) }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  const picker = page.getByRole("dialog", { name: "Add product" });
  await expect(
    picker.getByText("This customer has no active products."),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "New product for this customer" })
    .click();

  const form = page.getByRole("dialog", { name: "New product" });
  await expect(form.getByText(`For ${customer}.`)).toBeVisible();
  const supplierPicker = form.getByRole("combobox", { name: "Supplier" });
  const value = await supplierPicker
    .locator("option", { hasText: supplier })
    .getAttribute("value");
  await supplierPicker.selectOption(value!);
  await form.getByRole("textbox", { name: "Name", exact: true }).fill(product);
  await form.getByRole("textbox", { name: /^Sell price/ }).fill("4.00");
  await form.getByRole("textbox", { name: /^Buy price/ }).fill("3.00");
  await form.getByRole("button", { name: "Add Product" }).click();

  // Straight to quantity, with the new Product's prices to override.
  const qty = page.getByRole("dialog", { name: product });
  await qty.getByRole("button", { name: "2,000", exact: true }).click();
  const sell = qty.getByRole("textbox", { name: "Sell price/pc (Tk)" });
  await expect(sell).toHaveValue("4.00");
  await sell.fill("3.755");
  await expect(qty.getByRole("alert")).toHaveText(
    "Use at most 2 decimal places.",
  );
  await expect(
    qty.getByRole("button", { name: "Add to order" }),
  ).toBeDisabled();
  await sell.fill("3.75");
  await expect(qty.getByText("Product price Tk 4.00")).toBeVisible();
  await qty.getByRole("button", { name: "Add to order" }).click();
  await expect(qty).toBeHidden();

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save order" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  const totals = page.getByRole("definition");
  await expect(totals.getByText("Tk 7,500.00", { exact: true })).toBeVisible();
  await expect(totals.getByText("Tk 6,000.00", { exact: true })).toBeVisible();
});

test("Staff can't add a Product or change prices on the order form", async ({
  page,
  browser,
}, testInfo) => {
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const customer = `Lucky Bakery ${run}`;
  const supplier = `Suzinas ${run}`;
  const product = `Cake box ${run}`;
  const customerUrl = await addCustomer(page, customer);
  await addSupplier(page, supplier);
  await addProduct(page, customerUrl, {
    name: product,
    supplier,
    sell: "5.00",
    buy: "4.00",
  });

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto("/orders/new");
  await staff
    .getByRole("searchbox", { name: "Search customers" })
    .fill(customer);
  await staff.getByRole("button", { name: new RegExp(customer) }).click();
  await staff.getByRole("button", { name: "Add product" }).click();
  const picker = staff.getByRole("dialog", { name: "Add product" });
  await expect(
    picker.getByText("Product missing? Ask a manager to add it."),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "New product for this customer" }),
  ).toHaveCount(0);

  await picker.getByRole("button", { name: new RegExp(product) }).click();
  const qty = staff.getByRole("dialog", { name: product });
  await expect(qty.getByText("Sell · Tk 5.00/pc")).toBeVisible();
  await expect(qty.getByRole("textbox", { name: /price/ })).toHaveCount(0);
  await staff.context().close();
});
