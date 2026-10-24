import { expect, test } from "@playwright/test";
import { activityAfter, lastActivityId } from "./support/activity";
import { addCustomer } from "./support/master-data";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// Customers and Suppliers (SPEC §4.1, §4.2, issue #7). Records are new each
// run and burn real codes; E2E runs before go-live only (ADR 0002).

test("Admin adds, edits, finds, deactivates and deletes a Customer", async ({
  page,
}, testInfo) => {
  const name = `Highway Sweets ${Date.now()} ${testInfo.project.name}`;
  const before = await lastActivityId();

  await addCustomer(page, name);
  await expect(page.getByText(/^C-\d{4,}$/)).toBeVisible();

  await page.getByRole("link", { name: "Edit customer" }).click();
  await page.getByRole("textbox", { name: "Phone" }).fill("01722000000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("01722000000")).toBeVisible();

  await page.goto("/customers");
  const search = page.getByRole("searchbox", { name: "Search Customers" });
  await search.fill(name);
  await search.press("Enter");
  await page.getByRole("link", { name }).click();

  await page.getByRole("button", { name: "Deactivate" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(page.getByText("Customer deactivated.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL("/customers");

  const log = (await activityAfter(before)).filter((row) =>
    row.entityLabel?.endsWith(name),
  );
  expect(log.map((row) => row.action)).toEqual([
    "insert",
    "update",
    "update",
    "delete",
  ]);
  expect(log.every((row) => row.userName === "Test Admin")).toBe(true);
});

test("a Supplier needs a WhatsApp number", async ({ page }, testInfo) => {
  const name = `Suzinas ${Date.now()} ${testInfo.project.name}`;

  await page.goto("/suppliers/new");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Phone" }).fill("01811000000");
  await page
    .getByRole("textbox", { name: "Address" })
    .fill("Plot 4, Tongi BSCIC");
  await page.getByRole("button", { name: "Add Supplier" }).click();
  await expect(page.getByText("Enter a WhatsApp number.")).toBeVisible();

  await page.getByRole("textbox", { name: "WhatsApp" }).fill("01811000000");
  await page.getByRole("button", { name: "Add Supplier" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/^S-\d{4,}$/)).toBeVisible();
});

test("Staff can view Customers but not change them", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  const name = `Lucky Bakery ${Date.now()}`;
  const detailUrl = await addCustomer(page, name);

  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto("/customers");
  await expect(staff.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(staff.getByRole("link", { name: "Add Customer" })).toBeHidden();

  await staff.goto(detailUrl);
  await expect(staff.getByRole("heading", { name })).toBeVisible();
  await expect(staff.getByRole("link", { name: "Edit customer" })).toBeHidden();
  await expect(staff.getByRole("button", { name: "Deactivate" })).toBeHidden();

  for (const path of [
    "/customers/new",
    `${new URL(detailUrl).pathname}/edit`,
  ]) {
    await staff.goto(path);
    await expect(
      staff.getByRole("heading", { name: "No access" }),
    ).toBeVisible();
  }
});
