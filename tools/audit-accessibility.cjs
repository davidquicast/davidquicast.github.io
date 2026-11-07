#!/usr/bin/env node
/* Audit a built, local portfolio page with the project's locked browser tools. */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const site = path.resolve(process.env.AUDIT_SITE || ".local/production");
const output = path.resolve(process.env.AUDIT_REPORT || ".local/redesign/evidence/accessibility-production.json");
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function audit() {
  if (!fs.existsSync(path.join(site, "index.html"))) throw new Error("Build production before auditing accessibility.");
  const server = http.createServer((request, response) => {
    try {
      let target = path.resolve(site, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
      if (target !== site && !target.startsWith(site + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      if (fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
      response.writeHead(200, { "content-type": types[path.extname(target)] || "application/octet-stream" });
      fs.createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const target = new URL(process.env.AUDIT_PATH || "/", origin);
    if (target.origin !== origin) throw new Error("AUDIT_PATH must stay within the built local site.");
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const audits = [];
    for (const width of [320, 390, 1440]) {
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        try {
          const response = await page.goto(target.href, { waitUntil: "networkidle" });
          if (response.status() !== 200) throw new Error(`AUDIT_PATH returned HTTP ${response.status()}.`);
          await page.evaluate(async (selectedTheme) => {
            await document.fonts.ready;
            document.documentElement.dataset.theme = selectedTheme;
          }, theme);
          const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          audits.push({
            width,
            theme,
            violations: result.violations,
            blocking: result.violations.filter((item) => ["serious", "critical"].includes(item.impact)).length,
          });
        } finally {
          await context.close();
        }
      }
    }
    const blocking = audits.reduce((sum, item) => sum + item.blocking, 0);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      JSON.stringify({ path: target.pathname, threshold: "serious or critical WCAG A/AA findings", blocking, audits }, null, 2) + "\n"
    );
    console.log(`${audits.length} browser/theme audits; ${blocking} serious or critical findings. Report: ${output}`);
    process.exitCode = blocking ? 1 : 0;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
audit().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
