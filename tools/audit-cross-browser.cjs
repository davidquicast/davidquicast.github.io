#!/usr/bin/env node
// Optional cross-engine browser check. Install the selected browser in Docker first.
const fs = require("node:fs");
const path = require("node:path");
const { chromium, firefox, webkit } = require("playwright");
const engines = { chromium, firefox, webkit };
const selected = process.env.AUDIT_BROWSER || "firefox";
const base = process.env.AUDIT_URL || "http://127.0.0.1:8080";
const folder = process.env.AUDIT_OUTPUT || ".local/redesign/evidence/cross-browser";
const routes = [
  "/",
  "/?view=all",
  "/?view=projects",
  "/?view=blogs",
  "/?view=research",
  "/about/",
  "/projects/",
  "/blog/",
  "/publications/",
  "/projects/mcdaqc_15_open_deep_research/",
  "/blog/2025/shrink-wsl2-docker-virtual-disks/",
  "/blog/2025/private-synthetic-data-generation/",
  "/blog/2026/the-axis-between-memory-and-agency/",
  "/blog/2022/",
  "/blog/tag/web-development/",
  "/blog/category/web-development/",
  "/404.html",
  "/resume/",
];
async function run() {
  if (!engines[selected]) throw new Error("AUDIT_BROWSER must be chromium, firefox or webkit.");
  fs.mkdirSync(folder, { recursive: true });
  const launch = selected === "chromium" ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] } : {};
  const browser = await engines[selected].launch(launch);
  const version = browser.version();
  const failures = [],
    results = [];
  try {
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: width < 768 ? "dark" : "light",
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/livereload.js*", (route) => route.abort());
      for (const route of routes) {
        errors.length = 0;
        const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
        await page.waitForFunction(() => window.portfolioPretext?.snapshot().elements.length > 0);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => {
          const feed = document.querySelector("[data-profile-feed]");
          return !feed || (feed.dataset.feedReady === "true" && feed.dataset.feedBusy !== "true");
        });
        await page.waitForTimeout(80);
        const measurement = await page.evaluate(() => {
          const measured = [];
          document.querySelectorAll('[data-pretext-ready="true"]').forEach((element) => {
            if (!element.getClientRects().length || element.closest("[hidden]")) return;
            const wrapper = element.querySelector(".pretext-composition");
            const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
            const rows = new Set();
            while (walker.nextNode()) {
              const node = walker.currentNode;
              for (let i = 0; i < node.length; i++) {
                if (!node.textContent[i].trim()) continue;
                const range = document.createRange();
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                for (const rect of range.getClientRects()) rows.add(Math.round(rect.top));
              }
            }
            measured.push({ text: element.textContent, predicted: Number(element.dataset.pretextLines), actual: rows.size });
          });
          return { overflow: document.documentElement.scrollWidth - innerWidth, measured };
        });
        const result = {
          route,
          width,
          status: response.status(),
          overflow: measurement.overflow,
          measured: measurement.measured.length,
          lineDifferences: measurement.measured.filter((item) => item.actual !== item.predicted),
          errors: [...errors],
        };
        results.push(result);
        if (result.status !== 200 || result.overflow > 1 || !result.measured || result.lineDifferences.length || result.errors.length)
          failures.push(result);
        if ((route === "/" && width === 1440) || (route === "/blog/" && width === 390) || (route.includes("shrink-wsl2") && width === 320))
          await page.screenshot({
            path: path.join(folder, selected + "-" + width + "-" + (route === "/" ? "home" : route.includes("shrink") ? "article" : "blog") + ".png"),
          });
      }
      if (width === 390) {
        await page.goto(new URL("/", base).href, { waitUntil: "networkidle" });
        const about = page.locator(".main-navigation a").filter({ hasText: "About" });
        await about.focus();
        await page.keyboard.press("Enter");
        await page.waitForSelector("[data-about-ready=true]");
        if (!(await page.locator("[data-content-overlay-dialog]").isVisible())) failures.push({ issue: "About keyboard overlay unavailable" });
        await page.keyboard.press("Escape");
        await page.waitForSelector("[data-content-overlay-dialog][open]", { state: "hidden" });
        if (!(await about.evaluate((el) => el === document.activeElement))) failures.push({ issue: "overlay focus not restored" });
        await page.goto(new URL("/projects/", base).href, { waitUntil: "networkidle" });
        await page.locator("[data-search]").fill("no-such-project-unique-query");
        if (!(await page.locator("[data-empty]").isVisible())) failures.push({ issue: "empty search state unavailable" });
        await page.locator("[data-reset]").click();
        if ((await page.locator("[data-search]").inputValue()) !== "") failures.push({ issue: "search reset failed" });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  const report = { browser: selected, version, pages: results.length, results, failures };
  fs.writeFileSync(path.join(folder, selected + "-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ browser: selected, version, pages: results.length, failures }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
