const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to the production Docker preview.");
async function ready(page, query = "") {
  await page.goto(new URL("/" + query, base).href, { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
}
async function observeTransitions(page) {
  await page.addInitScript(() => {
    window.observedThemeTransitions = [];
    const native = document.startViewTransition?.bind(document);
    if (native)
      document.startViewTransition = (update) => {
        const transition = native(update);
        window.observedThemeTransitions.push(transition);
        return transition;
      };
  });
}
async function settleTheme(page) {
  await page.evaluate(() => Promise.all(window.observedThemeTransitions.map((transition) => transition.finished.catch(() => {}))));
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "");
}

test("compact toolbar keeps working search, clear, ownership and ordering controls", async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await ready(page, "?view=projects");
    const input = page.locator("[data-feed-search]");
    await input.fill("Synthetic Data Generator");
    await expect(page.locator("[data-feed-item][data-feed-visible=true]")).toHaveCount(1);
    expect(new URL(page.url()).searchParams.get("q")).toBe("Synthetic Data Generator");
    await page.keyboard.press("Tab");
    await expect(page.locator("[data-feed-clear]")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    expect(new URL(page.url()).searchParams.has("q")).toBe(false);
    const contributions = await page.locator('[data-feed-kind="project"][data-feed-project-type="contributions"]').count();
    expect(contributions).toBeGreaterThan(0);
    await page.locator("[data-project-filter=contributions]").click();
    await expect(page.locator("[data-feed-item][data-feed-visible=true]")).toHaveCount(contributions);
    await page.locator("[data-feed-sort]").selectOption("updated");
    await expect(page.locator("[data-feed-sort]")).toHaveValue("updated");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("updated");
    await expect(page.locator("[data-feed-view=featured]")).toHaveCount(0);
    const controls = await page.locator(".catalog-toolbar").evaluate((toolbar) => {
      const rects = [...toolbar.querySelectorAll("input,select,button[data-feed-view]")].map((element) => element.getBoundingClientRect());
      return {
        inside: rects.every((rect) => rect.left >= -1 && rect.right <= innerWidth + 1),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(controls.inside).toBe(true);
    expect(controls.overflow).toBeLessThanOrEqual(1);
  }
});

test("theme reveal responds to the keyboard and rapid changes preserve the latest choice", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "light" });
  await observeTransitions(page);
  await ready(page);
  const button = page.locator(".theme-toggle");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => window.observedThemeTransitions.length)).toBe(1);
  await settleTheme(page);
  await expect(button).toBeFocused();
  await page.evaluate(() => {
    document.querySelector(".theme-toggle").click();
    document.querySelector(".theme-toggle").click();
  });
  await settleTheme(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("portfolio-theme"))).toBe("dark");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(button).toHaveAttribute("aria-label", "Switch to light theme");
});

test("reduced motion and unavailable View Transitions keep theme changes immediate", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await observeTransitions(page);
  await ready(page);
  await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => window.observedThemeTransitions.length)).toBe(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    document.startViewTransition = undefined;
  });
  await page.locator(".theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "");
});

test("shared close and theme controls retain touch targets and visible keyboard focus", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await ready(page);
    const theme = page.locator(".theme-toggle");
    const target = await theme.boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
    const aboutLink = page.locator('.profile-resources a[href*="about"]');
    await aboutLink.click();
    const close = page.locator("[data-overlay-close]");
    await expect(close).toBeVisible();
    const rectangle = await close.boundingBox();
    expect(rectangle.height).toBeGreaterThanOrEqual(44);
    expect(rectangle.width).toBeGreaterThanOrEqual(44);
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-content-overlay-dialog]")).not.toBeVisible();
    await expect(aboutLink).toBeFocused();
  } finally {
    await context.close();
  }
});
