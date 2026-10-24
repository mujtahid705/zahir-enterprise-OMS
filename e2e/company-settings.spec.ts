import { expect, test } from "@playwright/test";
import { activityAfter, lastActivityId } from "./support/activity";

// SPEC §12: the Admin sets the company details, logo and signature printed on
// every document. The images live in the private company-assets bucket and
// reach the browser only through the app.

// 1×1 transparent RGBA PNG.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

test("Admin sets the letterhead, logo and signature", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "one run is enough");
  const before = await lastActivityId();
  const phone = `+880 1711-${String(Date.now()).slice(-6)}`;

  await page.goto("/settings/company");
  await page.getByLabel("Company name").fill("Zahir Enterprise");
  await page.getByLabel("Phone").fill(phone);
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Company details saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Phone")).toHaveValue(phone);

  await page.getByLabel("Logo file").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: TRANSPARENT_PNG,
  });
  await page.getByRole("button", { name: "Upload logo" }).click();
  await expect(page.getByText("Logo saved.")).toBeVisible();
  const logo = page.getByRole("img", { name: "Current logo", exact: true });
  await expect(logo).toHaveAttribute(
    "src",
    /^\/settings\/company\/image\/logo/,
  );

  const served = await page.request.get((await logo.getAttribute("src"))!);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(Buffer.from(await served.body()).equals(TRANSPARENT_PNG)).toBe(true);

  await page.getByLabel("Authorised signature file").setInputFiles({
    name: "signature.jpg",
    mimeType: "image/jpeg",
    buffer: JPEG,
  });
  await page.getByRole("button", { name: "Upload signature" }).click();
  await expect(page.getByText("Upload the signature as a PNG.")).toBeVisible();

  await page.getByLabel("Authorised signature file").setInputFiles({
    name: "signature.png",
    mimeType: "image/png",
    buffer: TRANSPARENT_PNG,
  });
  await page.getByRole("button", { name: "Upload signature" }).click();
  await expect(page.getByText("Signature saved.")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Current signature" }),
  ).toBeVisible();

  const log = await activityAfter(before);
  expect(
    log.filter(
      (row) =>
        row.entityLabel === "Company settings" && row.userName === "Test Admin",
    ),
  ).toHaveLength(3);
});

test("a signed-out visitor can't fetch the company images", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const response = await context.request.get("/settings/company/image/logo", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/login");
});
