const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
test.beforeAll(() => {
  execFileSync("bundle", ["exec", "ruby", "scripts/verify-site-chrome.rb"], { stdio: "pipe" });
});
const ORIGIN = "http://127.0.0.1:8091";
const fixture = ".local/redesign/readcv-implementation/independent-audit/chrome-fixture";
function markup(name, withScript = true) {
  const source = fs.readFileSync(`${fixture}/${name}/site/article.html`, "utf8");
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${ORIGIN}/assets/css/portfolio.css"><style>main{margin:40px 20px}.editorial-post{max-width:600px}.article-content{min-height:3000px}.site-footer{margin-inline:0}</style></head><body class="${
    name === "enabled" ? "has-fixed-footer" : ""
  }">${source
    .replace(/src="\/fixture\/assets\/js\/site-chrome.js"/, `src="${ORIGIN}/assets/js/site-chrome.js"`)
    .replace(/<script[\s\S]*?<\/script>/g, (script) => (withScript ? script : ""))}</body></html>`;
}
async function mount(page, name = "default") {
  await page.goto(ORIGIN);
  await page.setContent(markup(name));
}
async function scale(page) {
  return page.locator(".site-progress-fill").evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
}
test("article progress follows native scroll and content resize without autonomous animation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page);
  await expect(page.locator("div[data-reading-progress]")).toBeVisible();
  expect(await scale(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect.poll(() => scale(page)).toBeGreaterThan(0.3);
  const before = await scale(page);
  await page.waitForTimeout(80);
  expect(await scale(page)).toBeCloseTo(before, 5);
  await page.locator(".article-content").evaluate((element) => {
    element.style.minHeight = "6000px";
  });
  await expect.poll(() => scale(page)).toBeLessThan(before);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => scale(page)).toBe(1);
});
test("fixed footer reserves its measured height after mobile wrapping", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page, "enabled");
  const footer = page.locator("[data-site-footer]");
  await expect(footer).toHaveCSS("position", "fixed");
  const height = await footer.evaluate((element) => element.getBoundingClientRect().height);
  await expect
    .poll(() => page.locator("body").evaluate((element) => parseFloat(getComputedStyle(element).paddingBottom)))
    .toBeGreaterThanOrEqual(height);
  await page.setViewportSize({ width: 320, height: 568 });
  await footer.locator(".footer-credit").evaluate((element) => {
    element.append(document.createTextNode(" Fixture footer with longer text to verify wrapping and dynamic reserved space."));
  });
  await expect
    .poll(async () =>
      page.evaluate(
        () => parseFloat(getComputedStyle(document.body).paddingBottom) >= document.querySelector("[data-site-footer]").getBoundingClientRect().height
      )
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const contentBottom = await page.locator("main").evaluate((element) => element.getBoundingClientRect().bottom);
  const footerTop = await footer.evaluate((element) => element.getBoundingClientRect().top);
  expect(contentBottom).toBeLessThanOrEqual(footerTop);
});
test("reduced-motion progress remains user-driven and no-script chrome is decorative", async ({ page, browser }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page);
  expect(await page.locator(".site-progress-fill").evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(
    0.01
  );
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect.poll(() => scale(page)).toBeGreaterThan(0);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await context.newPage();
  await fallback.goto(ORIGIN);
  await fallback.setContent(markup("enabled", false));
  await expect(fallback.locator("div[data-reading-progress]")).toBeHidden();
  await expect(fallback.getByRole("heading", { name: "Fixture article" })).toBeVisible();
  await expect(fallback.locator("[data-site-footer]")).toHaveCSS("position", "static");
  await expect(fallback.locator("main")).toBeVisible();
  await context.close();
});
