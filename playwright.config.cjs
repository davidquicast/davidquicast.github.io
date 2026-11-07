const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: false,
  // Keep browser memory and timing reproducible on developer machines.
  workers: 1,
  reporter: "list",
  use: {
    headless: true,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] },
  },
  webServer: { command: "node tests/serve-fixture.cjs", port: 8091, reuseExistingServer: true },
  outputDir: ".local/redesign/evidence/test-results",
});
