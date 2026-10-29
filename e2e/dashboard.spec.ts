import { expect, test } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { addOrder } from "./support/orders";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// Dashboard (SPEC §10, DESIGN.md §7, issue #17). Records are new each run
// and burn real order numbers; E2E runs before go-live only (ADR 0002).

test("shows status counts, this month, the chart and the newest Orders, without money for Staff", async ({
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
  await addOrder(page, customer, [product]);

  await page.goto("/");
  const recent = page
    .getByRole("region", { name: "Last 10 orders" })
    .getByText(customer)
    .filter({ visible: true });
  const month = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    month: "long",
    year: "numeric",
  }).format(new Date());
  await expect(page.getByRole("heading", { name: month })).toBeVisible();
  await expect(page.getByText("Buy total")).toBeVisible();
  await expect(page.getByText(/% of sell/)).toBeVisible();

  const chart = page.getByRole("region", { name: "Last 6 months" });
  await expect(chart.getByRole("img")).toBeVisible();
  await chart.getByRole("button", { name: "Show table" }).click();
  await expect(chart.getByRole("table")).toBeVisible();
  await expect(chart.getByRole("row")).toHaveCount(7);

  await expect(
    page.getByRole("heading", { name: /^Needs action · \d+$/ }),
  ).toBeVisible();

  await expect(recent).toBeVisible();
  await page.getByRole("link", { name: /^Created [\d,]+$/ }).click();
  await expect(page).toHaveURL(/\/orders\?status=created$/);

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto("/");
  await expect(staff.getByRole("heading", { name: month })).toBeVisible();
  await expect(staff.getByText("Sell total")).toBeVisible();
  await expect(staff.getByText("Buy total")).toHaveCount(0);
  await expect(staff.getByText(/% of sell/)).toHaveCount(0);
  await expect(
    staff.getByRole("region", { name: "Last 6 months" }),
  ).toHaveCount(0);
  await staff.context().close();
});
