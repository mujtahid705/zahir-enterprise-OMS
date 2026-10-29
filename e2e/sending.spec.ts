import { expect, test } from "@playwright/test";
import { addCustomer, addProduct, addSupplier } from "./support/master-data";
import { addOrder } from "./support/orders";

// Sending documents (SPEC §6.3, §8.4, issue #13): the forward flow
// Created → WO Sent → Delivered → Invoiced, ending locked. The phone project
// stands in for the share sheet, whose first use is cancelled; the desktop
// one downloads. Records are new each run (ADR 0002).

test("sending each document moves the Order forward and the Invoice locks it", async ({
  page,
}, testInfo) => {
  // Sets up its own master data, then sends four documents.
  test.setTimeout(90_000);
  const phone = testInfo.project.name === "phone";
  if (phone)
    await page.addInitScript(() => {
      const shared: string[] = [];
      Object.assign(window, { shared });
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async ({ files }: { files: File[] }) => {
          // Only the first share of the test is cancelled, reloads included.
          if (!sessionStorage.getItem("cancelled")) {
            sessionStorage.setItem("cancelled", "1");
            throw new DOMException("Share canceled", "AbortError");
          }
          shared.push(files[0]!.name);
        },
      });
    });

  const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)} ${testInfo.project.name}`;
  const customer = `Highway Sweets ${run}`;
  const suzinas = `Suzinas ${run}`;
  const rahim = `Rahim Plastics ${run}`;
  const customerUrl = await addCustomer(page, customer);
  await addSupplier(page, suzinas);
  await addSupplier(page, rahim);
  const bread = `Bread poly packet ${run}`;
  const bag = `Carry bag large ${run}`;
  for (const [name, supplier] of [
    [bread, suzinas],
    [bag, rahim],
  ] as const)
    await addProduct(page, customerUrl, {
      name,
      supplier,
      sell: "2.50",
      buy: "2.00",
    });
  const number = await addOrder(page, customer, [bread, bag]);
  const slug = (name: string) => name.replace(/\s+/g, "-");

  const verb = phone ? "Share" : "Download";
  const orderPage = page.getByRole("main").locator("section").first();
  const status = (label: string) =>
    expect(orderPage.getByText(label, { exact: true }).first()).toBeVisible();

  async function send(docNo: string, fileName: string, warnings: string[]) {
    await page.getByRole("button", { name: `${verb} ${docNo}` }).click();
    const dialog = page.getByRole("dialog", { name: `${verb} ${docNo}` });
    for (const warning of warnings)
      await expect(
        dialog.getByRole("list", { name: "Warnings" }),
      ).toContainText(warning);
    if (phone) {
      await dialog.getByRole("button", { name: "Share PDF" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("status")).toHaveText(`${docNo} shared`);
      expect(
        await page.evaluate(() => (window as { shared?: string[] }).shared),
      ).toContain(fileName);
    } else {
      await expect(
        dialog.getByRole("link", { name: "Open WhatsApp chat" }),
      ).toHaveAttribute("href", /^https:\/\/wa\.me\/8801\d+\?text=/);
      const download = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Download PDF" }).click();
      expect((await download).suggestedFilename()).toBe(fileName);
      await expect(page.getByRole("status")).toHaveText(
        `Downloaded ${fileName}`,
      );
    }
  }

  await status("Created");
  if (phone) {
    // Closing the share sheet changes nothing (SPEC §6.3).
    await page.getByRole("button", { name: `Share WO-${number}-A` }).click();
    const dialog = page.getByRole("dialog", { name: `Share WO-${number}-A` });
    await dialog.getByRole("button", { name: "Share PDF" }).click();
    await expect(
      dialog.getByRole("button", { name: "Share PDF" }),
    ).toBeEnabled();
    await dialog.getByRole("button", { name: "Close" }).click();
    await page.reload();
    await expect(
      page.getByRole("listitem", { name: `WO-${number}-A · ${suzinas}` }),
    ).toContainText("Not sent");
  }

  await send(`WO-${number}-A`, `WO-${number}-A_${slug(suzinas)}.pdf`, []);
  await status("Created");
  await expect(orderPage.getByText("WO 1/2")).toBeVisible();
  await expect(
    page.getByRole("listitem", { name: `WO-${number}-A · ${suzinas}` }),
  ).toContainText(/Sent \d+ \w+ \d{4}, \d+:\d+ [AP]M · dated/);

  await send(`WO-${number}-B`, `WO-${number}-B_${slug(rahim)}.pdf`, []);
  await status("WO Sent");

  await send(`CH-${number}`, `CH-${number}_${slug(customer)}.pdf`, []);
  await status("Delivered");

  await send(`INV-${number}`, `INV-${number}_${slug(customer)}.pdf`, [
    "Sending the Invoice locks this order.",
  ]);
  await status("Invoiced");
  await expect(orderPage.getByText("Locked", { exact: true })).toBeVisible();
  await expect(orderPage).toContainText(
    "Invoice sent, so this order is locked. Documents can still be downloaded.",
  );

  const history = page.getByRole("region", { name: "History" });
  await expect(history).toContainText(
    "Status Delivered → Invoiced (automatic)",
  );
  await expect(history).toContainText("Order locked: Invoice sent");
  await expect(history).toContainText("Status Created → WO Sent (automatic)");

  // Re-sending is still allowed, with the date locked.
  await page.getByRole("button", { name: `${verb} INV-${number}` }).click();
  const again = page.getByRole("dialog", { name: `${verb} INV-${number}` });
  await expect(again.getByLabel("Invoice date")).toBeDisabled();
  await expect(again).toContainText("Dates are locked with the order.");
});
