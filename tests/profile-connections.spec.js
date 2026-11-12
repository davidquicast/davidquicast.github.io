const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");
async function home(page) {
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-links]")).toHaveAttribute("data-profile-links-ready", "true");
}
test("phone exposes five connections and a native keyboard disclosure, with RSS last and CV beside availability", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  const root = page.locator("[data-profile-links]");
  const total = Number(await root.getAttribute("data-link-count"));
  const details = root.locator("details");
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(5);
  await expect(details).not.toHaveAttribute("open", "");
  const summary = details.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(total);
  await expect(root.locator(".profile-social-link").last()).toHaveAttribute("data-profile-id", "rss");
  await expect(summary).toContainText("Fewer links");
  await page.keyboard.press("Enter");
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(5);
  await expect(summary).toBeFocused();
  const position = await page.evaluate(() => {
    const status = document.querySelector(".profile-status-row").getBoundingClientRect();
    const links = document.querySelector("[data-profile-links]").getBoundingClientRect();
    const cv = document.querySelector('.profile-status-row a[href*="resume"]').getBoundingClientRect();
    const available = document.querySelector(".profile-availability").getBoundingClientRect();
    return {
      above: status.bottom < links.top,
      aligned: Math.abs(cv.top - available.top),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(position.above).toBe(true);
  expect(position.aligned).toBeLessThan(1);
  expect(position.overflow).toBeLessThanOrEqual(1);
  await page.locator('.profile-status-row a[href*="resume"]').click();
  await expect(page.locator("[data-overlay-body] .resume-preview")).toBeVisible();
});
test("desktop shows every connection while it fits, then offers disclosure when height is constrained", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await home(page);
  const root = page.locator("[data-profile-links]");
  const total = Number(await root.getAttribute("data-link-count"));
  await expect(root).toHaveAttribute("data-profile-foldable", "false");
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(total);
  await expect(root.locator("summary")).toBeHidden();
  await page.setViewportSize({ width: 1440, height: 540 });
  await expect(root).toHaveAttribute("data-profile-foldable", "true");
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(5);
  await root.locator("summary").click();
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(total);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(total);
  await root.locator("summary").click();
  await expect(root.locator(".profile-social-link:visible")).toHaveCount(5);
});
test("connections remain reachable through native details without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const root = page.locator("[data-profile-links]");
    const total = Number(await root.getAttribute("data-link-count"));
    await expect(root.locator(".profile-social-link:visible")).toHaveCount(5);
    await root.locator("summary").click();
    await expect(root.locator(".profile-social-link:visible")).toHaveCount(total);
    await expect(root.locator(".profile-social-link").last()).toHaveAttribute("data-profile-id", "rss");
  } finally {
    await context.close();
  }
});
