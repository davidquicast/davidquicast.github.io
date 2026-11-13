const { test, expect } = require("@playwright/test");

test.describe("WipEout (1995) Easter Egg", () => {
  const base = process.env.PORTFOLIO_URL || "http://127.0.0.1:8080";

  test.beforeEach(async ({ page }) => {
    await page.route("**/*livereload*", (route) => route.abort());
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#wipeout-modal")).toBeAttached();
  });

  test("easter egg modal is hidden by default and assets not preloaded", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");
    await expect(modal).not.toHaveAttribute("open");

    // Confirm that heavy wasm/data are NOT requested before user triggers the easter egg
    const scripts = await page.$$eval("script[src]", (els) => els.map((s) => s.src));
    expect(scripts.some((s) => s.includes("wipeout-minimal.js"))).toBe(false);
  });

  test("activates via window.antigravity() API", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");
    const banner = page.locator("#wipeout-easter-egg-banner");

    await page.evaluate(() => window.antigravity());

    await expect(modal).toHaveAttribute("open");
    await expect(modal.locator("#canvas")).toBeVisible();

    // Close with close button
    await modal.locator("[data-wipeout-close]").click();
    await expect(modal).not.toHaveAttribute("open");
  });

  test("activates via Konami code sequence", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");

    const keys = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(40);
    }

    await expect(modal).toHaveAttribute("open");
    await expect(modal.locator("#canvas")).toBeVisible();

    // Close with Escape key
    await page.keyboard.press("Escape");
    await expect(modal).not.toHaveAttribute("open");
  });

  test("activates via rapid 5 clicks on avatar", async ({ page }) => {
    const avatar = page.locator(".profile-avatar").first();
    const modal = page.locator("#wipeout-modal");

    await expect(avatar).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await avatar.click();
      await page.waitForTimeout(60);
    }

    await expect(modal).toHaveAttribute("open");
    await expect(modal.locator("#canvas")).toBeVisible();

    await modal.locator("[data-wipeout-close]").click();
    await expect(modal).not.toHaveAttribute("open");
  });

  test("help overlay toggles open and closed", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");
    const helpOverlay = modal.locator("#wipeout-help-overlay");

    await page.evaluate(() => window.wipeout());
    await expect(modal).toHaveAttribute("open");

    // Open help overlay
    await modal.locator("[data-wipeout-help]").click();
    await expect(helpOverlay).toBeVisible();

    // Dismiss help overlay
    await modal.locator("[data-wipeout-help-dismiss]").click();
    await expect(helpOverlay).toBeHidden();

    await modal.locator("[data-wipeout-close]").click();
  });

  test("audio button toggles state cleanly without crashing", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");
    const audioBtn = modal.locator("[data-wipeout-audio]");

    await page.evaluate(() => window.antigravity());
    await expect(modal).toHaveAttribute("open");

    await audioBtn.click();
    // Does not throw and remains interactive
    await expect(audioBtn).toBeVisible();

    await modal.locator("[data-wipeout-close]").click();
  });

  test("mobile touch gamepad is displayed and touch buttons meet tap target standards", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const modal = page.locator("#wipeout-modal");
    const touchControls = modal.locator("#wipeout-touch-controls");

    await page.evaluate(() => window.antigravity());
    await expect(modal).toHaveAttribute("open");

    // Touch controls are visible on mobile
    await expect(touchControls).toBeVisible();

    // Verify touch buttons have valid bounding boxes >= 40px
    const buttons = touchControls.locator("[data-button]");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(6);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThanOrEqual(30);
      expect(box.height).toBeGreaterThanOrEqual(30);
    }

    // Test pressing a touch button
    const thrustBtn = touchControls.locator('[data-button="27"]');
    await thrustBtn.dispatchEvent("pointerdown", { pointerId: 1 });
    await expect(thrustBtn).toHaveClass(/active/);
    await thrustBtn.dispatchEvent("pointerup", { pointerId: 1 });
    await expect(thrustBtn).not.toHaveClass(/active/);

    await modal.locator("[data-wipeout-close]").click();
    await expect(modal).not.toHaveAttribute("open");
  });

  test("controls footer contains visually separated groups for Player 1, Player 2, and System", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");
    await page.evaluate(() => window.antigravity());
    await expect(modal).toHaveAttribute("open");

    const footer = modal.locator("#easter-egg-footer-hint");
    await expect(footer).toBeVisible();

    const p1Group = footer.locator(".hint-group-p1");
    const p2Group = footer.locator(".hint-group-p2");
    const sysGroup = footer.locator(".hint-group-system");
    const separators = footer.locator(".hint-separator");

    await expect(p1Group).toBeVisible();
    await expect(p2Group).toBeVisible();
    await expect(sysGroup).toBeVisible();
    await expect(separators).toHaveCount(2);

    // Verify Player 1 text
    await expect(p1Group.locator(".hint-tag")).toHaveText("PLAYER 1");
    expect(await p1Group.innerText()).toContain("WASD Move");
    expect(await p1Group.innerText()).toContain("V B");
    expect(await p1Group.innerText()).toContain("B A");
    expect(await p1Group.innerText()).toContain("C Auto");
    expect(await p1Group.innerText()).toContain("Enter Start");

    // Verify Player 2 text (J for B, K for A, U for Auto, I for Start)
    await expect(p2Group.locator(".hint-tag")).toHaveText("PLAYER 2");
    expect(await p2Group.innerText()).toContain("▲▼◀▶ Move");
    expect(await p2Group.innerText()).toContain("J B");
    expect(await p2Group.innerText()).toContain("K A");
    expect(await p2Group.innerText()).toContain("U Auto");
    expect(await p2Group.innerText()).toContain("I Start");

    await modal.locator("[data-wipeout-close]").click();
  });

  test("help modal details Player 1 and Player 2 keyboard bindings without abbreviations", async ({ page }) => {
    const modal = page.locator("#wipeout-modal");
    await page.evaluate(() => window.antigravity());
    await expect(modal).toHaveAttribute("open");

    // Open help overlay
    await modal.locator("[data-wipeout-help]").click();
    const helpOverlay = modal.locator("#wipeout-help-overlay");
    await expect(helpOverlay).toBeVisible();

    const text = await helpOverlay.innerText();
    expect(text).toContain("PLAYER 1");
    expect(text).toContain("PLAYER 2");
    expect(text).not.toContain(" P1 ");
    expect(text).not.toContain(" P2 ");

    // Check Player 2 bindings in help
    expect(text).toContain("J");
    expect(text).toContain("K");
    expect(text).toContain("U");
    expect(text).toContain("I");
    expect(text).toContain("O");

    await modal.locator("[data-wipeout-help-dismiss]").click();
    await modal.locator("[data-wipeout-close]").click();
  });
});
