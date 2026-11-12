import { defineConfig } from "@playwright/test";

/** Run browser acceptance serially against an already-started disposable instance. */
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://127.0.0.1:33379",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
