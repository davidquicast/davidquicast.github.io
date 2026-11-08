const { test, expect } = require("@playwright/test");
const { entrancesFinished } = require("./support/motion.cjs");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to test the running portfolio.");

async function open(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/*livereload*", (route) => route.abort());
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
}

test("profile identity, name lines and first catalog composition enter, then settle at full opacity", async ({ page }) => {
  const names = [];
  await page.exposeFunction("recordAnimation", (name) => names.push(name));
  await page.addInitScript(() => {
    document.addEventListener("animationstart", (event) => window.recordAnimation(event.animationName), true);
  });
  await open(page, "no-preference");
  await expect(page.locator(".profile-feed-grid")).toHaveAttribute("data-motion-settled", "", { timeout: 10000 });
  await entrancesFinished(page);
  for (const name of ["motion-avatar", "motion-rise", "editorial-line-in", "motion-card"]) expect(names).toContain(name);
  // Pretext composed the name into real lines that animate individually.
  await expect(page.locator(".profile-name h1")).toHaveAttribute("data-pretext-ready", "true");
  await expect(page.locator(".profile-name h1 .pretext-line").first()).toBeVisible();
  const opacities = await page
    .locator(".profile-avatar, .profile-summary, .profile-feed-grid > [data-feed-item]:not([hidden])")
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
  expect(opacities.every((value) => value === "1")).toBe(true);
});

test("filtering after the first composition does not replay the CSS entrance", async ({ page }) => {
  await open(page, "no-preference");
  await expect(page.locator(".profile-feed-grid")).toHaveAttribute("data-motion-settled", "", { timeout: 10000 });
  await page.locator('[data-feed-view="projects"]').click();
  await page.locator('[data-feed-view="all"]').click();
  const replayed = await page
    .locator(".profile-feed-grid")
    .evaluate((grid) => grid.getAnimations({ subtree: true }).filter((animation) => animation.animationName === "motion-card").length);
  expect(replayed).toBe(0);
});

test("the category indicator follows the pressed tab", async ({ page }) => {
  await open(page, "no-preference");
  const indicator = page.locator(".feed-tabs-indicator");
  await expect(indicator).toHaveAttribute("aria-hidden", "true");
  for (const view of ["research", "projects", "all"]) {
    const tab = page.locator(`[data-feed-view="${view}"]`);
    await tab.click();
    await expect(async () => {
      const [a, b] = await Promise.all([tab.boundingBox(), indicator.boundingBox()]);
      expect(Math.abs(a.x - b.x)).toBeLessThan(1.5);
      expect(Math.abs(a.width - b.width)).toBeLessThan(1.5);
    }).toPass({ timeout: 3000 });
  }
});

test("reduced motion shows everything immediately, without entrances or the pulse", async ({ page }) => {
  await open(page, "reduce");
  await expect(page.locator(".profile-feed-grid")).toHaveAttribute("data-motion-settled", "");
  const finite = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);
  expect(finite).toBe(0);
  await expect(page.locator(".profile-availability")).toBeVisible();
  expect(await page.locator(".profile-avatar").evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
});
