import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// E2E runs against local `next dev` (connected to ze-dev once the database lands). SPEC §13.0.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
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
