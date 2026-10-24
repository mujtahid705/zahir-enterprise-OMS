import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STATE } from "./e2e/support/users";

config({ path: [".env.local", ".env"], quiet: true });

// Next allows one `next dev` per project: set E2E_PORT=3000 to reuse yours.
const PORT = Number(process.env.E2E_PORT ?? 3100);

// E2E runs against local `next dev` connected to the single Supabase project,
// with seeded @test.ze Users. It commits real rows, so it runs before go-live
// only (SPEC §13.0, ADR 0002).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    storageState: ADMIN_STATE,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
