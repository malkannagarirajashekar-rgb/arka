import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:5173";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL === "chrome" ? "chrome" : "msedge";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/html", open: "never" }],
  ],
  use: {
    baseURL,
    browserName: "chromium",
    // Use the installed Edge channel instead of Playwright's bundled Chromium.
    // This avoids the missing chrome-headless-shell error on machines where
    // Playwright browser binaries have not been downloaded.
    channel: browserChannel,
    headless: true,
    screenshot: "on",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  },
});
