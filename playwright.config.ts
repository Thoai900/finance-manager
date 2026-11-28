import { defineConfig, devices } from "@playwright/test";
import { OWNER_STATE } from "./tests/e2e/global-setup";

const PORT = 3300;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    storageState: OWNER_STATE,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // CI: chạy bản đã build. Máy local: chạy bản dev.
    command: process.env.CI
      ? `npm run start -- -p ${PORT}`
      : `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/settings`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
