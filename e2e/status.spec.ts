import { expect, test } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { addOrder } from "./support/orders";

// Manual status changes (SPEC §5.5, §6.4, issue #16), as the Admin: Change
// status, Cancel and Restore, Mark Completed, Unlock. Records are new each
// run (ADR 0002).

test("the Admin changes status by hand, cancels and restores, completes and unlocks", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const customer = `Highway Sweets ${run}`;
  const supplier = `Suzinas ${run}`;
  const customerUrl = await addCustomer(page, customer);
  await addSupplier(page, supplier);
  const bread = `Bread poly packet ${run}`;
  await addProduct(page, customerUrl, {
    name: bread,
    supplier,
    sell: "2.50",
    buy: "2.00",
  });
  const number = await addOrder(page, customer, [bread]);

  const orderPage = page.getByRole("main").locator("section").first();
  const history = page.getByRole("region", { name: "History" });
  const status = (label: string) =>
    expect(orderPage.getByText(label, { exact: true }).first()).toBeVisible();

  const change = page.getByRole("form", { name: "Change status" });
  await change.getByLabel("Change status to").selectOption("Delivered");
  await change.getByLabel("Note (optional)").fill("Delivered by hand");
  await change.getByRole("button", { name: "Change status" }).click();
  await status("Delivered");
  await expect(history).toContainText(
    "Status Created → Delivered: Delivered by hand",
  );

  await page.getByRole("button", { name: "Cancel order" }).click();
  const cancel = page.getByRole("dialog", { name: "Cancel this order?" });
  await cancel.getByLabel("Reason for cancelling").fill("Customer called off");
  await cancel.getByRole("button", { name: "Cancel order" }).click();
  await expect(cancel).toBeHidden();
  await status("Cancelled");
  await expect(orderPage).toContainText(": Customer called off.");
  await expect(
    page.getByRole("button", { name: /^(Download|Share) INV-/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Change status" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Restore" }).click();
  await page
    .getByRole("alertdialog", { name: "Restore this order?" })
    .getByRole("button", { name: "Restore" })
    .click();
  await status("Delivered");
  await expect(history).toContainText("Order restored to Delivered");

  await page.getByRole("button", { name: "Mark Completed" }).click();
  await page
    .getByRole("alertdialog", { name: "Mark this order Completed?" })
    .getByRole("button", { name: "Mark Completed" })
    .click();
  await status("Completed");
  await expect(orderPage.getByText("Locked", { exact: true })).toBeVisible();
  await expect(history).toContainText("Order locked: marked Completed");

  await page.getByRole("button", { name: "Unlock" }).click();
  const unlock = page.getByRole("dialog", { name: "Unlock this order?" });
  await unlock.getByLabel("Reason for unlocking").fill("Wrong quantity");
  await unlock.getByRole("button", { name: "Unlock" }).click();
  await expect(unlock).toBeHidden();
  await expect(orderPage.getByText("Locked", { exact: true })).toHaveCount(0);
  await expect(history).toContainText("Order unlocked: Wrong quantity");
  await expect(page.getByText(`ORD-${number}`).first()).toBeVisible();
});
