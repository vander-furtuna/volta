import { defineConfig, devices } from "@playwright/test";

// Overridable for machines where port 3000 is taken or only system Chrome is installed:
// PLAYWRIGHT_BASE_URL=http://localhost:3001 PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Fortaleza",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: true,
    env: { DEMO_MODE: "true" },
  },
});
