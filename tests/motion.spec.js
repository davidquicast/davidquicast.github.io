const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
const fixture = "http://127.0.0.1:8091/tests/readcv-interactions-fixture.html";

async function ready(page, reducedMotion = "no-preference", width = 1280) {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/*livereload*", (route) => route.abort());
  await page.goto(fixture, { waitUntil: "domcontentloaded" });
  const deck = page.locator("[data-project-deck]");
  await expect(deck).toHaveAttribute("data-deck-enhanced", "true");
  await deck.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(deck.locator("[data-deck-slide]:not([data-inactive]) :is(h2,h3) [data-pretext]")).toHaveAttribute("data-pretext-ready", "true");
  return deck;
}
const active = (deck) => deck.locator("[data-deck-slide]:not([data-inactive])");
const progress = (deck) =>
  deck.locator("[data-deck-progress]").evaluate((element) => ({
    time: element.getAnimations()[0]?.currentTime || 0,
    transform: getComputedStyle(element).transform,
    running: element.getAnimations().some((animation) => animation.playState === "running"),
  }));

test("project-deck component advances autonomously with native motion and composed selectable copy", async ({ page }) => {
  const deck = await ready(page);
  await expect(deck).toHaveAttribute("data-motion", "running");
  const initial = await deck.getAttribute("data-active");
  const title = await active(deck).locator(":is(h2,h3)").textContent();
  const url = await active(deck).locator(":is(h2,h3) a").getAttribute("href");
  const height = await deck.evaluate((element) => element.getBoundingClientRect().height);
  const before = await progress(deck);
  await expect.poll(async () => (await progress(deck)).time).toBeGreaterThan(before.time + 40);
  expect((await progress(deck)).transform).not.toBe(before.transform);
  await expect.poll(() => deck.getAttribute("data-active"), { timeout: 8000 }).not.toBe(initial);
  expect(await active(deck).locator(":is(h2,h3)").textContent()).not.toBe(title);
  expect(await active(deck).locator(":is(h2,h3) a").getAttribute("href")).not.toBe(url);
  expect(await deck.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(height, 0);
  await expect(active(deck).locator(":is(h2,h3) [data-pretext]")).toHaveAttribute("data-pretext-ready", "true");
  await expect(active(deck).locator(".pretext-composition").first()).not.toBeEmpty();
  expect(
    await active(deck)
      .locator("img")
      .evaluate((element) => element.complete && element.naturalWidth > 0)
  ).toBe(true);
  await expect(deck.locator("[data-deck-status]")).toHaveAttribute("aria-live", "off");
});

test("manual choice pauses indefinitely, explicit Resume works while focused and reading/background guards pause again", async ({ page }) => {
  test.setTimeout(35000);
  const deck = await ready(page);
  await deck.locator('[data-deck-index="1"]').click();
  await expect(deck).toHaveAttribute("data-active", "1");
  await expect(deck).toHaveAttribute("data-motion", "paused");
  await page.waitForTimeout(6200);
  await expect(deck).toHaveAttribute("data-active", "1");
  const toggle = deck.locator("[data-deck-pause]");
  await toggle.click();
  await expect(toggle).toBeFocused();
  await expect(deck).toHaveAttribute("data-motion", "running");
  await expect(deck).toHaveAttribute("data-active", "2", { timeout: 8000 });
  await deck.locator('[data-deck-index="0"]').focus();
  await expect(deck).toHaveAttribute("data-pause-reason", "focus");
  await deck.evaluate(() => document.activeElement.blur());
  await page.mouse.move(0, 0);
  await expect(deck).toHaveAttribute("data-motion", "running");
  const box = await deck.boundingBox();
  await page.mouse.move(box.x + 4, box.y + 4);
  await expect(deck).toHaveAttribute("data-pause-reason", "hover");
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(deck).toHaveAttribute("data-pause-reason", "hidden-tab");
  expect((await progress(deck)).running).toBe(false);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
    const spacer = document.createElement("div");
    spacer.style.height = "1200px";
    spacer.setAttribute("aria-hidden", "true");
    document.body.append(spacer);
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await expect(deck).toHaveAttribute("data-pause-reason", "offscreen");
});

test("reduced motion keeps component previews static while semantic links and Pretext remain functional", async ({ page }) => {
  const deck = await ready(page, "reduce");
  await expect(deck).toHaveAttribute("data-pause-reason", "reduced-motion");
  const before = await deck.getAttribute("data-active");
  await page.waitForTimeout(6200);
  await expect(deck).toHaveAttribute("data-active", before);
  await expect(deck.locator("[data-deck-pause]")).toBeHidden();
  await deck.locator('[data-deck-index="1"]').click();
  await expect(deck).toHaveAttribute("data-active", "1");
  await expect(active(deck).locator(":is(h2,h3) [data-pretext]")).toHaveAttribute("data-pretext-ready", "true");
  await expect(active(deck).locator(":is(h2,h3) a")).toHaveAttribute("href", /projects/);
  expect(await deck.locator("[data-deck-progress]").evaluate((element) => element.getAnimations().length)).toBe(0);
  expect(await active(deck).evaluate((element) => element.getAnimations().length)).toBe(0);
});

test("all component preview states retain readable geometry at 200 percent text and 320/390px", async ({ page }) => {
  for (const width of [320, 390]) {
    const deck = await ready(page, "reduce", width);
    await deck.locator(":is(h2,h3),p,button").evaluateAll((elements) => {
      const sizes = elements.map((element) => parseFloat(getComputedStyle(element).fontSize) * 2);
      elements.forEach((element, index) => {
        element.style.fontSize = sizes[index] + "px";
      });
      window.portfolioPretext.refresh();
    });
    for (const index of [0, 1, 2]) {
      await deck.locator(`[data-deck-index="${index}"]`).click();
      const geometry = await deck.evaluate((element) => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        clipped: element.scrollHeight > element.clientHeight + 1,
        activeCount: element.querySelectorAll("[data-deck-slide]:not([data-inactive])").length,
        inertCount: element.querySelectorAll("[data-deck-slide][inert]").length,
        mediaClipped: (() => {
          const slide = element.querySelector("[data-deck-slide]:not([data-inactive])");
          const image = slide.querySelector(".project-deck-media img").getBoundingClientRect();
          const frame = slide.querySelector(".project-deck-media").getBoundingClientRect();
          return image.top < frame.top - 1 || image.bottom > frame.bottom + 1 || image.left < frame.left - 1 || image.right > frame.right + 1;
        })(),
      }));
      expect(geometry.overflow, `${width}px state${index}`).toBeLessThanOrEqual(1);
      expect(geometry.clipped).toBe(false);
      expect(geometry.mediaClipped, `${width}px state${index} original image must fit its frame`).toBe(false);
      expect(geometry.activeCount).toBe(1);
      expect(geometry.inertCount).toBe(2);
      await expect(active(deck).locator(":is(h2,h3) [data-pretext]")).toHaveAttribute("data-pretext-ready", "true");
    }
  }
});

async function readyFeed(page, reducedMotion = "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/*livereload*", (route) => route.abort());
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-profile-feed]");
  await expect(root).toHaveAttribute("data-feed-ready", "true");
  await expect(root).toHaveAttribute("data-feed-busy", "false");
  await expect(root).toHaveAttribute("data-feed-current-view", "all");
  await expect(page.locator(".feed-tabs button")).toHaveCount(4);
  expect(await page.locator(".feed-tabs button").evaluateAll((buttons) => buttons.map((button) => button.dataset.feedView))).toEqual([
    "all",
    "projects",
    "blogs",
    "research",
  ]);
  await expect(page.locator("[data-project-deck]")).toHaveCount(0);
  return root;
}

test("live category and date changes animate the real masonry feed without replacing original media", async ({ page }) => {
  test.skip(!base, "Set PORTFOLIO_URL to test the running portfolio.");
  const root = await readyFeed(page);
  const originals = await page
    .locator("[data-feed-grid] > [data-feed-item]")
    .evaluateAll((cards) => Object.fromEntries(cards.map((card) => [card.dataset.feedId, card.querySelector("img")?.getAttribute("src")])));
  // Observe actual native animation creation. Polling active effects after the
  // click can miss finite 110/240ms motion when the browser transport is busy.
  await page.evaluate(() => {
    window.feedMotionSamples = [];
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = Reflect.apply(nativeAnimate, this, args);
      if (this.closest("[data-feed-grid]")) {
        window.feedMotionSamples.push({ frames: animation.effect.getKeyframes(), duration: animation.effect.getTiming().duration });
      }
      return animation;
    };
  });
  await page.locator('.feed-tabs [data-feed-view="projects"]').click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.feedMotionSamples.filter(
            (sample) => sample.duration > 0 && sample.duration <= 1000 && sample.frames[0].transform !== sample.frames.at(-1).transform
          ).length
      )
    )
    .toBeGreaterThan(0);
  await expect(root).toHaveAttribute("data-feed-busy", "false");
  const expected = await page.locator('[data-feed-item][data-feed-kind="project"]').count();
  await expect(page.locator('[data-feed-grid] > [data-feed-visible="true"]')).toHaveCount(expected);
  await page.locator("[data-feed-sort]").selectOption("newest");
  await expect(root).toHaveAttribute("data-feed-busy", "false");
  const cards = await page
    .locator('[data-feed-grid] > [data-feed-visible="true"]')
    .evaluateAll((cards) =>
      cards.map((card) => ({ id: card.dataset.feedId, date: Number(card.dataset.feedDate), image: card.querySelector("img")?.getAttribute("src") }))
    );
  expect(cards.every((card) => Number.isFinite(card.date))).toBe(true);
  expect(cards.map((card) => card.date)).toEqual(cards.map((card) => card.date).sort((a, b) => b - a));
  for (const card of cards) expect(card.image).toBe(originals[card.id]);
  await expect(page.locator('[data-feed-grid] > [data-feed-visible="true"] [data-pretext]').first()).toHaveAttribute("data-pretext-ready", "true");
});

test("live reduced-motion category changes stay static while real links and calculated text remain usable", async ({ page }) => {
  test.skip(!base, "Set PORTFOLIO_URL to test the running portfolio.");
  const root = await readyFeed(page, "reduce");
  await page.locator('.feed-tabs [data-feed-view="blogs"]').click();
  await expect(root).toHaveAttribute("data-feed-current-view", "blogs");
  await expect(root).toHaveAttribute("data-feed-busy", "false");
  expect(await page.locator("[data-feed-grid]").evaluate((grid) => grid.getAnimations({ subtree: true }).length)).toBe(0);
  const link = page
    .locator(
      '[data-feed-visible="true"] .writing-card-body a[data-pretext], [data-feed-visible="true"] .writing-card h2 a[data-pretext], [data-feed-visible="true"] h2 a[data-pretext]'
    )
    .first();
  await expect(link).toHaveAttribute("href", /\/blog\/\d{4}\//);
  await expect(link).toHaveAttribute("data-pretext-ready", "true");
});
