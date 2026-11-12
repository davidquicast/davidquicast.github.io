const { test, expect } = require("@playwright/test");
const fixture = "http://127.0.0.1:8091/tests/readcv-interactions-fixture.html";
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const entries = [
  { title: "Overview", description: "David Quispe", url: "/", type: "Page" },
  { title: "Personaxis", description: "Memory and agent behavior", url: "/projects/personaxis/", type: "Project" },
  { title: "Sécurité research", description: "Multilingual AI safety", url: "/blog/safety/", type: "Article" },
];
async function ready(page, options = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/search-index.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(options.entries || entries) })
  );
  if (options.ui) {
    const json = JSON.stringify(options.ui).replaceAll("<", "\\u003c");
    const source = readFileSync(join(__dirname, "readcv-interactions-fixture.html"), "utf8").replace(
      "<head>",
      `<head><script type="application/json" id="portfolio-ui">${json}</script>`
    );
    await page.route(fixture, (route) => route.fulfill({ status: 200, contentType: "text/html", body: source }));
  }
  await page.goto(fixture, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-search-open]")).toBeVisible();
  await expect(page.locator("[data-project-deck]")).toHaveAttribute("data-deck-enhanced", "true");
}

test("global search opens with keyboard, searches accent-insensitively and returns focus", async ({ page }) => {
  await ready(page);
  const trigger = page.locator("[data-search-open]");
  await trigger.focus();
  await page.keyboard.press("Control+k");
  const dialog = page.locator("[data-search-dialog]");
  const input = page.locator("[data-global-search-input]");
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill("securite");
  const result = page.locator(".search-result");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("Sécurité research");
  await page.keyboard.press("ArrowDown");
  await expect(result).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("html")).not.toHaveClass(/has-dialog/);
  await page.keyboard.press("/");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeHidden();
});

test("same-page search results dismiss the dialog and focus the destination section", async ({ page }) => {
  await ready(page, { entries: [{ title: "Gallery section", url: "/tests/readcv-interactions-fixture.html#gallery", type: "Page" }] });
  await page.locator("[data-search-open]").click();
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.locator(".search-result").click();
  await expect(page.locator("[data-search-dialog]")).toBeHidden();
  await expect(page).toHaveURL(/#gallery$/);
  await expect(page.locator("#gallery")).toBeFocused();
});

test("global search renders text safely and rejects executable or external result URLs", async ({ page }) => {
  await ready(page, {
    entries: [
      { title: "Unsafe URL", url: "javascript:window.xss=true" },
      { title: "Outside URL", url: "https://example.invalid/" },
      { title: "<img src=x onerror=window.xss=true>", url: "/projects/safe/", description: "<script>bad()</script>" },
    ],
  });
  await page.locator("[data-search-open]").click();
  await expect(page.locator(".search-result")).toHaveCount(1);
  await expect(page.locator(".search-result-title")).toHaveText("<img src=x onerror=window.xss=true>");
  await expect(page.locator(".search-result img,.search-result script")).toHaveCount(0);
  expect(await page.evaluate(() => window.xss)).toBeUndefined();
});

test("configured profile destinations remain real links while unsafe schemes are excluded", async ({ page }) => {
  await ready(page, {
    entries: [
      { title: "GitHub", url: "https://github.com/davidquicast", type: "Profile" },
      { title: "Email", url: "mailto:davidq@example.com", type: "Profile" },
      { title: "Unsafe", url: "javascript:alert(1)", type: "Profile" },
      { title: "Invalid email", url: "mailto:no-email", type: "Profile" },
    ],
  });
  await page.locator("[data-search-open]").click();
  await expect(page.locator(".search-result")).toHaveCount(2);
  const github = page.locator('.search-result[href="https://github.com/davidquicast"]');
  await expect(github).toHaveAttribute("target", "_blank");
  await expect(github).toHaveAttribute("rel", /noopener/);
  await expect(page.locator('.search-result[href="mailto:davidq@example.com"]')).toBeVisible();
});

test("theme search actions dispatch only fixed supported modes and close the dialog", async ({ page }) => {
  await page.addInitScript(() =>
    window.addEventListener("portfolio:set-theme", (event) => {
      window.chosenTestTheme = event.detail.theme;
    })
  );
  await ready(page, {
    entries: [
      { title: "Dark appearance", type: "Action", action: "dark" },
      { title: "Unsafe action", type: "Action", action: "execute-script" },
    ],
  });
  await page.locator("[data-search-open]").click();
  await expect(page.locator(".search-result")).toHaveCount(1);
  await page.locator("[data-global-search-input]").fill("dark");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-search-dialog]")).toBeHidden();
  expect(await page.evaluate(() => window.chosenTestTheme)).toBe("dark");
});

test("the resolved UI dictionary drives dynamic search, gallery, motion and filter labels", async ({ page }) => {
  await ready(page, {
    ui: {
      search: { result_singular: "Count {count}" },
      gallery: { title: "Test gallery", close: "Test close", next: "Test next", position: "Frame {current}/{total}" },
      motion: { pause: "Test pause", resume: "Test resume" },
      filters: { project_singular: "Item {count}" },
    },
  });
  await page.locator("[data-search-open]").click();
  await page.locator("[data-global-search-input]").fill("Personaxis");
  await expect(page.locator("[data-global-search-status]")).toHaveText("Count 1");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-search-dialog]")).toBeHidden();
  await page.locator("a[data-lightbox]").first().click();
  await expect(page.locator("#image-viewer h2")).toHaveText("Test gallery");
  await page.getByRole("button", { name: "Test next", exact: true }).click();
  await expect(page.locator('.image-dialog-controls [role="status"]')).toHaveText("Frame 2/2");
  await page.getByRole("button", { name: "Test close", exact: true }).click();
  await expect(page.locator("#image-viewer")).toBeHidden();
  await expect(page.locator("[data-deck-pause]")).toHaveText("Test pause");
  await page.locator("[data-deck-pause]").click();
  await expect(page.locator("[data-deck-pause]")).toHaveText("Test resume");
  await page.locator("[data-filter-root] [data-search]").fill("Memory");
  await expect(page.locator("[data-filter-root] [data-status]")).toHaveText("Item 1");
});

test("search has an actionable network failure state and retries successfully", async ({ page }) => {
  await ready(page);
  let attempts = 0;
  await page.route("**/search-index.json", (route) => {
    attempts += 1;
    return route.fulfill({ status: attempts === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(entries) });
  });
  await page.locator("[data-search-open]").click();
  await expect(page.locator("[data-global-search-recovery]")).toBeVisible();
  await expect(page.locator("[data-global-search-status]")).toContainText("unavailable");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("[data-global-search-recovery]")).toBeHidden();
  await expect(page.locator(".search-result")).toHaveCount(3);
  expect(attempts).toBe(2);
});

test("image viewer follows gallery keyboard controls and restores its real trigger", async ({ page }) => {
  await ready(page);
  const trigger = page.locator("a[data-lightbox]").first();
  await trigger.click();
  const viewer = page.locator("#image-viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("figcaption")).toHaveText("First original image");
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator("figcaption")).toHaveText("Second original image");
  await expect(viewer.locator('.image-dialog-controls [role="status"]')).toHaveText("2 / 2");
  await page.keyboard.press("ArrowLeft");
  await expect(viewer.locator("figcaption")).toHaveText("First original image");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("legacy zoomable picture markup becomes an accessible real-image link without competing runtimes", async ({ page }) => {
  await ready(page);
  const link = page.locator("a.native-image-link");
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", /\/assets\/img\/profile\/[^/]+\.webp$/u);
  await expect(link.locator("picture > img[data-zoomable]")).toHaveCount(1);
  await expect(link).toHaveAttribute("data-native-lightbox", "true");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#image-viewer")).toBeVisible();
  await expect(page.locator("#image-viewer figcaption")).toHaveText("Legacy image zoom caption");
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
});

test("autonomous project preview changes real content, composes text and pauses explicitly", async ({ page }) => {
  test.setTimeout(35000);
  await ready(page);
  const deck = page.locator("[data-project-deck]");
  await deck.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(deck).toHaveAttribute("data-motion", "running");
  await page.waitForFunction(() => window.portfolioPretext?.snapshot().elements.length > 0);
  const height = await deck.evaluate((element) => element.getBoundingClientRect().height);
  await expect(deck).toHaveAttribute("data-active", "1", { timeout: 8000 });
  await expect(deck.locator("[data-deck-slide]:not([data-inactive]) h3")).toHaveText("Open Deep Research");
  await expect(deck.locator("[data-deck-slide]:not([data-inactive]) [data-pretext-ready]")).toHaveCount(2);
  expect(await deck.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(height, 0);
  const pause = deck.locator("[data-deck-pause]");
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await expect(deck).toHaveAttribute("data-pause-reason", "manual");
  const progress = await deck.locator("[data-deck-progress]").evaluate((element) => element.getAnimations()[0].currentTime);
  await page.waitForTimeout(350);
  const still = await deck.locator("[data-deck-progress]").evaluate((element) => element.getAnimations()[0].currentTime);
  expect(still).toBeCloseTo(progress, 0);
  await pause.click();
  await expect(deck).toHaveAttribute("data-motion", "running");
  await page.waitForTimeout(150);
  expect(await deck.locator("[data-deck-progress]").evaluate((element) => element.getAnimations()[0].currentTime)).toBeGreaterThan(still);
});

test("project previews pause for reading and offscreen, and reduced motion keeps manual controls", async ({ page }) => {
  await ready(page);
  const deck = page.locator("[data-project-deck]");
  await page.mouse.move(0, 0);
  await expect(deck).toHaveAttribute("data-motion", "running");
  await deck.locator("h3 a").first().focus();
  await expect(deck).toHaveAttribute("data-pause-reason", "focus");
  await page.locator("[data-search-open]").focus();
  await expect(deck).toHaveAttribute("data-motion", "running");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(deck).toHaveAttribute("data-pause-reason", "offscreen");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await deck.scrollIntoViewIfNeeded();
  await expect(deck).toHaveAttribute("data-pause-reason", "reduced-motion");
  await expect(deck.locator("[data-deck-pause]")).toBeHidden();
  await deck.locator("[data-deck-next]").click();
  await expect(deck).toHaveAttribute("data-active", "1");
  await expect(deck.locator("[data-deck-slide]:not([data-inactive]) h3")).toHaveText("Open Deep Research");
});

test("filters restore browser history state and leave unknown criteria harmless", async ({ page }) => {
  await ready(page);
  const root = page.locator("[data-filter-root]");
  await root.locator("[data-search]").fill("Memory");
  await expect(root.locator("[data-filter-item]:visible")).toHaveCount(1);
  await page.evaluate(() => {
    history.pushState({}, "", "?q=Research&topic=ai");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(root.locator("[data-search]")).toHaveValue("Research");
  await expect(root.locator('[data-filter="ai"]')).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator("[data-filter-item]:visible")).toContainText("Open Deep Research");
  await page.goBack();
  await expect(root.locator("[data-search]")).toHaveValue("Memory");
  await expect(root.locator('[data-filter="all"]')).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator("[data-filter-item]:visible")).toContainText("Memory and Personaxis");
});

test("all semantic links and preview content remain readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  const page = await context.newPage();
  await page.goto(fixture);
  await expect(page.locator("[data-deck-slide]")).toHaveCount(3);
  await expect(page.locator("[data-deck-slide]").last()).toBeVisible();
  await expect(page.locator("[data-deck-controls]")).toBeHidden();
  await expect(page.locator("a[data-lightbox]").first()).toHaveAttribute("href", /\/assets\/img\/profile\/[^/]+\.webp$/u);
  await expect(page.locator("[data-search-open]")).toBeHidden();
  await context.close();
});

test("search and image controls remain usable with actual 200% text at 320 and 390px", async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [320, 390]) {
    await ready(page);
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll("body *")]
        .filter((element) => element instanceof HTMLElement)
        .map((element) => [element, parseFloat(getComputedStyle(element).fontSize)]);
      sizes.forEach(([element, size]) => {
        element.style.fontSize = size * 2 + "px";
      });
      window.portfolioPretext?.refresh();
    });
    await page.locator("[data-search-open]").click();
    await page.locator("[data-global-search-input]").fill("Personaxis");
    await expect(page.locator(".search-result")).toHaveCount(1);
    expect(await page.locator("[data-search-dialog]").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-search-dialog]")).toBeHidden();
    await page.locator("a[data-lightbox]").first().click();
    expect(await page.locator("#image-viewer").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#image-viewer figcaption")).toHaveText("Second original image");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

const live = process.env.PORTFOLIO_URL;
test("deployed global search opens real project content and retains original media in the nested viewer", async ({ page }) => {
  test.skip(!live, "Set PORTFOLIO_URL to verify actual Docker markup.");
  await page.goto(live);
  const originalURL = page.url();
  const documentToken = await page.evaluate(() => {
    window.searchOverlayToken = Math.random();
    return window.searchOverlayToken;
  });
  await expect(page.locator(".site-header [data-search-open]")).toHaveCount(0);
  await expect(page.locator("[data-search-dialog]")).toHaveAttribute("data-ready", "true");
  await page.locator("[data-feed-search]").focus();
  await page.keyboard.press("Control+k");
  await expect(page.locator("[data-search-dialog]")).toBeVisible();
  await page.locator("[data-global-search-input]").fill("Personaxis");
  const result = page.locator(".search-result").first();
  await expect(result).toContainText("Personaxis");
  const path = await result.getAttribute("href");
  await result.click();
  const content = page.locator("[data-content-overlay-dialog]");
  await expect(content).toBeVisible();
  await expect(page).toHaveURL(new URL(path, live).href);
  expect(await page.evaluate(() => window.searchOverlayToken)).toBe(documentToken);
  const image = content.locator("[data-overlay-body] a[data-lightbox]").first();
  const original = await image.getAttribute("href");
  await image.click();
  await expect(page.locator("#image-viewer")).toBeVisible();
  await expect(page.locator("#image-viewer img")).toHaveAttribute("src", new URL(original, live).href);
  await expect.poll(() => page.locator("#image-viewer img").evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#image-viewer")).toBeHidden();
  await expect(content).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  await expect(page).toHaveURL(originalURL);
});

test("search contains its result scrolling and footer inside a short landscape viewport", async ({ page }) => {
  await ready(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("[data-search-open]").click();
  await expect(page.locator(".search-result").first()).toBeVisible();
  const dialog = page.locator("[data-search-dialog]");
  const bounds = await dialog.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    height: innerHeight,
  }));
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  await expect(page.locator("[data-search-close]")).toBeInViewport({ ratio: 1 });
  await expect(page.locator("[data-global-search-input]")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".search-footer")).toBeInViewport({ ratio: 1 });
});

test("late enhancement keeps sidebar, catalog and compact header geometry stable on the real site", async ({ page }) => {
  test.skip(!live, "Set PORTFOLIO_URL to check the running site markup.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*livereload*", (route) => route.abort());
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const pattern = "**/assets/js/readcv-interactions.js*";
    await page.route(pattern, async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto(live, { waitUntil: "commit" });
      await expect(page.locator(".profile-sidebar h1")).toBeVisible();
      await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
      await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
      await page.waitForFunction(() => document.readyState !== "loading");
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.querySelectorAll(".frontpage-wall img")]
            .filter((image) => {
              const rect = image.getBoundingClientRect();
              return rect.width && rect.top < innerHeight && rect.bottom > 0;
            })
            .map((image) => image.decode().catch(() => {}))
        );
      });
      const geometry = () =>
        page.evaluate(() => {
          const rect = (element) => {
            const bounds = element.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
          };
          return {
            scrollY,
            identity: rect(document.querySelector(".profile-sidebar")),
            catalog: rect(document.querySelector(".profile-catalog")),
            header: rect(document.querySelector(".site-header")),
            tools: rect(document.querySelector(".rail-tools")),
            searchSlot: rect(document.querySelector(".catalog-controls .feed-search")),
            controls: rect(document.querySelector(".catalog-controls")),
            cards: [...document.querySelectorAll('.frontpage-wall > [data-feed-visible="true"]')].map((element, index) => ({
              key: element.dataset.feedId || element.querySelector(":is(h2,h3) a")?.getAttribute("href") || String(index),
              ...rect(element),
            })),
          };
        });
      // Essential compact navigation and theme do not depend on this deferred download.
      const about = page.locator('.profile-resources a[href*="about"]');
      await about.focus();
      await expect(about).toBeFocused();
      await expect(about).toHaveAttribute("href", /\/about\/$/);
      await expect(page.locator(".menu-toggle")).toHaveCount(0);
      const theme = page.locator(".theme-toggle");
      await expect(theme).toBeVisible();
      const previousTheme = await page.locator("html").getAttribute("data-theme");
      await theme.click();
      const chosenTheme = await page.locator("html").getAttribute("data-theme");
      expect(["light", "dark"]).toContain(chosenTheme);
      expect(chosenTheme).not.toBe(previousTheme);
      expect(await page.evaluate(() => localStorage.getItem("portfolio-theme"))).toBe(chosenTheme);
      await expect(page.locator(".site-header [data-search-open]")).toHaveCount(0);
      const before = await geometry();
      expect(before.cards.length).toBeGreaterThan(3);
      expect(before.searchSlot.width).toBeGreaterThan(0);
      expect(before.searchSlot.height).toBeGreaterThan(0);
      release();
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("[data-search-dialog]")).toHaveAttribute("data-ready", "true");
      await expect(page.locator(".profile-sidebar [data-pretext]").first()).toHaveAttribute("data-pretext-ready", "true");
      await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
      await expect(page.locator("[data-project-deck]")).toHaveCount(0);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await geometry();
      expect(after.cards.map((card) => card.key)).toEqual(before.cards.map((card) => card.key));
      expect(after.scrollY).toBe(before.scrollY);
      for (const key of ["identity", "catalog", "header", "tools", "searchSlot", "controls"]) {
        for (const property of ["x", "y", "width", "height"]) {
          expect(Math.abs(after[key][property] - before[key][property]), `${width}px ${key}.${property}`).toBeLessThanOrEqual(1);
        }
      }
      before.cards.forEach((card, index) => {
        for (const property of ["x", "y", "width", "height"]) {
          expect(Math.abs(after.cards[index][property] - card[property]), `${width}px card${index} ${card.key}.${property}`).toBeLessThanOrEqual(1);
        }
      });
      await expect(page.locator("html")).toHaveAttribute("data-theme", chosenTheme);
    } finally {
      release();
      await page.unroute(pattern);
    }
  }
});
