import { expect, test } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { addOrder } from "./support/orders";
import { signInAs } from "./support/session";
import { E2E_USERS, e2ePassword } from "./support/users";

// Document PDFs and Preview (SPEC §8, §13.2 GET, issue #12). Records are new
// each run and burn real order numbers; E2E runs before go-live only
// (ADR 0002).

test("each document previews as a PDF without marking anything sent", async ({
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

  const number = await addOrder(page, customer, [product]);
  const slug = (name: string) => name.replace(/\s+/g, "-");

  // Staff may preview every document too.
  const staff = await signInAs(browser, E2E_USERS.staff.email, e2ePassword());
  await staff.goto(page.url());
  for (const fileName of [
    `WO-${number}-A_${slug(supplier)}.pdf`,
    `CH-${number}_${slug(customer)}.pdf`,
    `INV-${number}_${slug(customer)}.pdf`,
  ]) {
    await staff
      .getByRole("button", { name: `Preview ${fileName}`, exact: true })
      .click();
    const dialog = staff.getByRole("dialog", { name: fileName });
    await expect(dialog).toContainText("Preview only. Not marked as sent.");
    const src = await dialog
      .locator(`iframe[title="${fileName}"]`)
      .getAttribute("src");
    const pdf = await staff.request.get(src!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["content-disposition"]).toContain(fileName);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  }

  await staff.reload();
  await expect(
    staff.getByRole("list", { name: "Work Orders" }).getByText(/Not sent/),
  ).toBeVisible();
  await staff.context().close();
});
