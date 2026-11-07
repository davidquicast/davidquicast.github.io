const { test, expect } = require("@playwright/test");
const fixture = "http://127.0.0.1:8091/tests/card-menu-fixture.html";
async function ready(page, fallback = false) {
  if (fallback)
    await page.addInitScript(() => {
      Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: undefined });
      Object.defineProperty(HTMLElement.prototype, "hidePopover", { configurable: true, value: undefined });
    });
  await page.goto(fixture, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#trigger1")).toBeVisible();
  await expect(page.locator("#menu1")).toBeHidden();
}

test("native card menu follows keyboard navigation, Escape and a single open state", async ({ page }) => {
  await ready(page);
  const first = page.locator("#trigger1");
  const panel = page.locator("#menu1");
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(panel.locator("a")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(panel.locator("button")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(panel.locator("a")).toBeFocused();
  await page.keyboard.press("End");
  await expect(panel.locator("button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(panel.locator("button")).toBeFocused();
  await page.locator("#trigger2").click();
  await expect(panel).toBeHidden();
  await expect(page.locator("#menu2")).toBeVisible();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await page.locator("#outside").click();
  await expect(page.locator("#menu2")).toBeHidden();
  await expect(page.locator("#outside")).toBeFocused();
});

test("Tab dismisses the menu and advances to the next real card link", async ({ page }) => {
  await ready(page);
  await page.locator("#trigger1").click();
  await page.keyboard.press("Tab");
  await expect(page.locator("#menu1")).toBeHidden();
  await expect(page.locator("#project2")).toBeFocused();
});

test("copy link writes the canonical public project URL and reports actual success", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ready(page);
  await page.locator("#trigger1").click();
  const copy = page.locator("#menu1 [data-copy-link]");
  await copy.click();
  await expect(copy).toHaveAttribute("data-copy-state", "copied");
  await expect(copy).toHaveText("Link copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://davidquicast.github.io/projects/personaxis/");
  await page.keyboard.press("Escape");
  await page.locator("#trigger1").click();
  await expect(copy).toHaveText("Copy link");
});

test("clipboard denial stays recoverable and unsafe URLs never reach the clipboard", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          window.copyAttempts = (window.copyAttempts || 0) + 1;
          throw new Error("denied");
        },
      },
    })
  );
  await ready(page);
  await page.locator("#trigger1").click();
  const copy = page.locator("#menu1 [data-copy-link]");
  await copy.click();
  await expect(copy).toHaveAttribute("data-copy-state", "error");
  await expect(copy).toBeEnabled();
  await expect(page.locator("#menu1 [data-card-menu-status]")).toContainText("Copy failed");
  for (const value of ["javascript:alert(1)", "https://example.invalid/", "https://user:password@davidquicast.github.io/private/"]) {
    await copy.evaluate((element, url) => {
      element.dataset.url = url;
    }, value);
    await copy.click();
    await expect(page.locator("#menu1 [data-card-menu-status]")).toHaveText("This link is unavailable.");
  }
  expect(await page.evaluate(() => window.copyAttempts)).toBe(1);
});

test("late clipboard completion cannot reopen a dismissed menu or overwrite its reset state", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          new Promise((resolve) => {
            window.finishCopy = resolve;
          }),
      },
    })
  );
  await ready(page);
  await page.locator("#trigger1").click();
  const copy = page.locator("#menu1 [data-copy-link]");
  await copy.click();
  await expect(copy).toHaveAttribute("aria-busy", "true");
  await page.locator("#outside").click();
  await page.evaluate(() => window.finishCopy());
  await expect(page.locator("#menu1")).toBeHidden();
  await expect(copy).toHaveText("Copy link");
  await expect(page.locator("#outside")).toBeFocused();
});

test("image action dismisses the menu before opening the viewer and returns focus to the ellipsis", async ({ page }) => {
  await ready(page);
  await page.locator("#trigger1").click();
  await page.locator("#menu1 a").click();
  await expect(page.locator("#menu1")).toBeHidden();
  await expect(page.locator("#image-viewer")).toBeVisible();
  await expect(page.locator("#image-viewer button").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#trigger1")).toBeFocused();
});

test("fallback menus and enlarged text stay inside narrow and landscape viewports", async ({ page }) => {
  await ready(page, true);
  for (const size of [
    { width: 320, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.locator("#trigger2").click();
    await expect(page.locator("#menu2")).toBeVisible();
    const box = await page.locator("#menu2").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(7);
    expect(box.y).toBeGreaterThanOrEqual(7);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width - 7);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height - 7);
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 320, height: 640 });
  await page.locator("#menu2").evaluate((element) => {
    element.style.fontSize = "32px";
  });
  await page.locator("#trigger2").click();
  const large = await page.locator("#menu2").boundingBox();
  expect(large.x + large.width).toBeLessThanOrEqual(313);
  expect(large.y + large.height).toBeLessThanOrEqual(633);
  await page.keyboard.press("Tab");
  await expect(page.locator("#menu2")).toBeHidden();
  await expect(page.locator("#outside")).toBeFocused();
});

test("without JavaScript, primary project links remain usable and inactive menu buttons stay hidden", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(fixture);
  await expect(page.locator("#project1")).toBeVisible();
  await expect(page.locator("#project2")).toBeVisible();
  await expect(page.locator("[data-card-menu]").first()).toBeHidden();
  await context.close();
});
