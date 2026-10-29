import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addCustomer } from "./support/master-data";

// The Activity Log screen and History tabs (SPEC §11.2, issue #19). Staff
// being kept out of /activity is covered in users.spec.ts.

test("Admin finds a Customer's edit in the Activity Log, its History and the CSV", async ({
  page,
}, testInfo) => {
  const name = `Logged Sweets ${Date.now()} ${testInfo.project.name}`;
  const detail = await addCustomer(page, name);
  await page.getByRole("link", { name: "Edit customer" }).click();
  await page.getByRole("textbox", { name: "Phone" }).fill("01722000000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("01722000000")).toBeVisible();

  await page.goto("/activity");
  const search = page.getByRole("searchbox", { name: "Search records" });
  await search.fill(name);
  await search.press("Enter");
  await expect(page).toHaveURL(/[?&]q=/);

  await expect(
    page.getByRole("heading", {
      name: /^\w{3}, \d{1,2} \w{3} \d{4} — 2 changes$/,
    }),
  ).toBeVisible();
  const edit = page.getByText(
    new RegExp(
      `^Edited customer C-\\d+ ${name}: phone 01711000000 → 01722000000$`,
    ),
  );
  await expect(edit).toBeVisible();
  await expect(
    page.getByText(new RegExp(`^Created customer C-\\d+ ${name}$`)),
  ).toBeVisible();

  await edit.click();
  const diff = page.locator("details[open]");
  await expect(diff.getByText("Phone", { exact: true })).toBeVisible();
  await expect(diff.getByText("01711000000", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const csv = await readFile((await (await download).path())!, "utf8");
  expect(csv.split("\r\n")[0]).toBe("Time,User,Action,Record,Summary");
  expect(csv).toContain(`phone 01711000000 → 01722000000`);
  expect(csv.trim().split("\r\n")).toHaveLength(3);

  await page.goto(detail);
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\?tab=history$/);
  await expect(page.getByText(/^Edited customer .*: phone/)).toBeVisible();
  await expect(page.getByText(/^Created customer /)).toBeVisible();
});
