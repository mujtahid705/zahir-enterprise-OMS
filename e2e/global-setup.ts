import { chromium, type FullConfig } from "@playwright/test";
import { seedUsers } from "../scripts/seed-users.ts";
import {
  ADMIN_STATE,
  E2E_USERS,
  e2ePassword,
  seedUserList,
} from "./support/users";

// Seeds the @test.ze Users (resetting passwords a previous run changed), then
// signs in as the test Admin once so most specs start signed in.
export default async function globalSetup(config: FullConfig) {
  await seedUsers(seedUserList(), { onExisting: "sync" });

  const baseURL = config.projects[0]!.use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USERS.admin.email);
  await page.getByLabel("Password").fill(e2ePassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
  await page.context().storageState({ path: ADMIN_STATE });
  await browser.close();
}
