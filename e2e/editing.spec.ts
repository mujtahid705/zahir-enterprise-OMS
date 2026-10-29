import { expect, test, type Page } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { addOrder } from "./support/orders";

// Editing an Order before anything is sent (SPEC §5.3, §5.5, issue #14).
// Records are new each run (ADR 0002).

async function seed(page: Page, run: string) {
  const customer = `Highway Sweets ${run}`;
  const suzinas = `Suzinas ${run}`;
  const rahim = `Rahim Plastics ${run}`;
  const plastech = `Plastech ${run}`;
  const customerUrl = await addCustomer(page, customer);
  for (const supplier of [suzinas, rahim, plastech])
    await addSupplier(page, supplier);
  const bread = `Bread poly packet ${run}`;
  const bag = `Carry bag large ${run}`;
  const tray = `Cake tray ${run}`;
  const productUrl: Record<string, string> = {};
  for (const [name, supplier, sell] of [
    [bread, suzinas, "2.50"],
    [bag, rahim, "4.00"],
    [tray, plastech, "6.00"],
  ] as const) {
    await addProduct(page, customerUrl, { name, supplier, sell, buy: "2.00" });
    productUrl[name] = page.url();
  }
  return { customer, suzinas, rahim, plastech, bread, bag, tray, productUrl };
}

test("editing swaps a Supplier's Work Order for the next letter and keeps the header", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const s = await seed(page, run);
  const number = await addOrder(page, s.customer, [s.bread, s.bag]);
  const orderUrl = page.url();

  await page.getByRole("link", { name: "Edit order" }).click();
  // Opens on Items, Customer fixed.
  const items = page.getByRole("list", { name: "Items" });
  await expect(items.getByRole("button", { name: /Bread poly/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change" })).toHaveCount(0);

  await items.getByRole("button", { name: new RegExp(s.bag) }).click();
  await page
    .getByRole("dialog", { name: s.bag })
    .getByRole("button", { name: "Remove item" })
    // By keyboard: on the phone, next dev's indicator covers the button.
    .press("Enter");
  await items.getByRole("button", { name: new RegExp(s.bread) }).click();
  const qty = page.getByRole("dialog", { name: s.bread });
  await qty.getByRole("button", { name: "2,000", exact: true }).click();
  await qty.getByRole("button", { name: "Update" }).click();
  await page.getByRole("button", { name: "Add another product" }).click();
  await page
    .getByRole("dialog", { name: "Add product" })
    .getByRole("button", { name: new RegExp(s.tray) })
    .click();
  const trayQty = page.getByRole("dialog", { name: s.tray });
  await trayQty.getByRole("button", { name: "500", exact: true }).click();
  await trayQty.getByRole("button", { name: "Add to order" }).click();

  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("textbox", { name: "Customer reference" }).fill("PO-91");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page).toHaveURL(orderUrl);
  const workOrders = page.getByRole("list", { name: "Work Orders" });
  await expect(workOrders.getByRole("listitem")).toHaveCount(2);
  await expect(
    workOrders.getByRole("listitem", { name: `WO-${number}-A · ${s.suzinas}` }),
  ).toBeVisible();
  await expect(
    workOrders.getByRole("listitem", {
      name: `WO-${number}-C · ${s.plastech}`,
    }),
  ).toBeVisible();
  await expect(page.getByText("PO-91")).toBeVisible();
  await expect(page.getByText("Tk 8,000.00").first()).toBeVisible();
});

test("a stale edit is refused, prices refresh from Products, and a deactivated Product is tagged", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  test.setTimeout(90_000);
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const s = await seed(page, run);
  await addOrder(page, s.customer, [s.bread]);
  const orderUrl = page.url();

  // Two edit forms open; the first save wins.
  const other = await context.newPage();
  await other.goto(`${orderUrl}/edit`);
  await page.goto(`${orderUrl}/edit`);
  for (const [tab, ref] of [
    [other, "PO-1"],
    [page, "PO-2"],
  ] as const) {
    await tab.getByRole("button", { name: "Review", exact: true }).click();
    await tab.getByRole("textbox", { name: "Customer reference" }).fill(ref);
    await tab.getByRole("button", { name: "Save changes" }).click();
  }
  await expect(
    page.getByText(
      /^This order was changed by .+ at .+\. Reload to see their changes\.$/,
    ),
  ).toBeVisible();
  await other.goto(orderUrl);
  await expect(other.getByText("PO-1")).toBeVisible();
  await other.close();

  // The Product's price changes; the Order keeps its own until refreshed.
  await page.goto(s.productUrl[s.bread]!);
  await page.getByRole("link", { name: "Edit product" }).click();
  await page.getByRole("textbox", { name: /^Sell price/ }).fill("3");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.goto(orderUrl);
  const totals = page.locator('dl[aria-label="Totals"]');
  await expect(totals.getByText("Tk 12,500.00")).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh prices from products" })
    .click();
  await page.getByRole("button", { name: "Refresh prices" }).click();
  await expect(totals.getByText("Tk 15,000.00")).toBeVisible();

  await page.goto(s.productUrl[s.bread]!);
  await page.getByRole("button", { name: "Deactivate" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Deactivate" })
    .click();
  await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();
  await page.goto(orderUrl);
  await expect(page.getByText("Deactivated")).toBeVisible();
});

test("editing after sending warns first, flags Needs re-send and cancels an emptied Work Order", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  test.setTimeout(90_000);
  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const s = await seed(page, run);
  const number = await addOrder(page, s.customer, [s.bread, s.bag]);
  const woA = `WO-${number}-A`;
  const woB = `WO-${number}-B`;
  const download = async (docNo: string) => {
    await page.getByRole("button", { name: `Download ${docNo}` }).click();
    const saved = page.waitForEvent("download");
    await page
      .getByRole("dialog", { name: `Download ${docNo}` })
      .getByRole("button", { name: "Download PDF" })
      .click();
    await saved;
    await expect(page.getByRole("status")).toHaveText(/^Downloaded /);
  };
  await download(woA);
  await download(woB);

  await page.getByRole("link", { name: "Edit order" }).click();
  const items = page.getByRole("list", { name: "Items" });
  await items.getByRole("button", { name: new RegExp(s.bag) }).click();
  await page
    .getByRole("dialog", { name: s.bag })
    .getByRole("button", { name: "Remove item" })
    .press("Enter");
  await items.getByRole("button", { name: new RegExp(s.bread) }).click();
  const qty = page.getByRole("dialog", { name: s.bread });
  await qty.getByRole("button", { name: "2,000", exact: true }).click();
  await qty.getByRole("button", { name: "Update" }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();

  const warning = page.getByRole("alertdialog", {
    name: "Save changes to sent documents?",
  });
  await expect(warning.getByRole("listitem")).toHaveText([
    `${woA} to ${s.suzinas} no longer matches and will need re-sending.`,
    `${woB} to ${s.rahim} will be cancelled: ${s.rahim} has no items left.`,
  ]);
  await warning.getByRole("button", { name: "Save changes" }).click();

  const workOrders = page.getByRole("list", { name: "Work Orders" });
  const rowA = workOrders.getByRole("listitem", {
    name: `${woA} · ${s.suzinas}`,
  });
  const rowB = workOrders.getByRole("listitem", {
    name: `${woB} · ${s.rahim}`,
  });
  await expect(rowA.getByText("Needs re-send")).toBeVisible();
  await expect(
    rowB.getByText(`Tell ${s.rahim} that ${woB} is cancelled.`),
  ).toBeVisible();

  await rowB.getByRole("button", { name: /^Done/ }).click();
  await expect(rowB.getByText("Cancelled · supplier told")).toBeVisible();
  await expect(rowB.getByRole("button", { name: /^Done/ })).toHaveCount(0);

  // Re-sending clears the flag.
  await download(woA);
  await expect(rowA.getByText("Needs re-send")).toHaveCount(0);
});
