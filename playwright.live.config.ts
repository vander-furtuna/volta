import { defineConfig } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const port = 3327;
const baseURL = `http://localhost:${port}`;
const fixtureURL = `http://127.0.0.1:${port + 1}`;
const preload = pathToFileURL(resolve("e2e/live/redirect-cw-fetch.mjs")).href;

export default defineConfig({
  testDir: "./e2e/live",
  workers: 1,
  reporter: "list",
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm build && pnpm start --hostname localhost --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    env: {
      APP_URL: baseURL,
      DEMO_MODE: "false",
      CW_ENVIRONMENT: "sandbox",
      CW_CLIENT_ID: "volta-fixture",
      CW_REDIRECT_URI: `${baseURL}/api/cw/oauth/callback`,
      SUPABASE_URL: fixtureURL,
      SUPABASE_SERVICE_ROLE_KEY: "supabase-fixture",
      SESSION_SECRET: "session-fixture",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${preload}`.trim(),
    },
  },
});
