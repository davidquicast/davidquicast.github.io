const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");

test("compact phone research preserves touch targets, complete titles and resource order", async ({ browser }) => {
  test.setTimeout(60000);
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.goto(new URL("/?view=research", base).href, { waitUntil: "networkidle" });
      await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
      await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      const cards = page.locator("[data-feed-visible=true].paper-card");
      expect(await cards.count()).toBeGreaterThan(0);
      for (const card of await cards.all()) {
        const image = await card.locator(".research-card-media").boundingBox();
        expect(image.width).toBe(56);
        expect(image.height).toBe(56);
        const resources = card.locator(".paper-card-actions a");
        for (const resource of await resources.all()) {
          const bounds = await resource.boundingBox();
          const layout = await resource.evaluate((element) => ({ width: element.offsetWidth, height: element.offsetHeight }));
          expect(layout.width).toBeGreaterThanOrEqual(44);
          expect(layout.height).toBeGreaterThanOrEqual(44);
          // Translated feed coordinates may round a 44px layout edge to 43.99994px.
          expect(bounds.width + 0.01).toBeGreaterThanOrEqual(44);
          expect(bounds.height + 0.01).toBeGreaterThanOrEqual(44);
          await expect(resource).toHaveAttribute("href", /\S+/u);
        }
        const title = await card.locator("h2").boundingBox();
        const actions = await card.locator(".paper-card-actions").boundingBox();
        expect(title.y + title.height).toBeLessThanOrEqual(actions.y + 1);
        const row = await card.boundingBox();
        expect(title.x + title.width).toBeLessThanOrEqual(row.x + row.width + 1);
        expect(await card.locator("h2").evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  }
});

test("compact research requests the small responsive image at desktop DPR two", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto(new URL("/?view=research", base).href, { waitUntil: "networkidle" });
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
    for (const image of await page.locator("[data-feed-visible=true].paper-card .research-card-media img").all()) {
      const src = await image.evaluate(async (node) => {
        await node.decode();
        return new URL(node.currentSrc).pathname;
      });
      expect(src).toMatch(/-320\.webp$/u);
    }
  } finally {
    await context.close();
  }
});
