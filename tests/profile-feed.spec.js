const { test, expect } = require("@playwright/test");
const fixture = "http://127.0.0.1:8091/tests/profile-feed-fixture.html";
const grid = "[data-feed-grid]";
const items = "[data-feed-item][data-feed-visible=true]";
async function ready(page, suffix = "") {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto(fixture + suffix);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
  await settled(page);
}
async function settled(page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.querySelector("[data-profile-feed]");
        const all = [...document.querySelectorAll("[data-feed-item]")];
        return root.dataset.feedBusy === "false" && all.every((el) => (el.dataset.feedVisible === "true") === !el.hidden);
      })
    )
    .toBe(true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function ids(page) {
  return page.locator(items).evaluateAll((nodes) => nodes.map((n) => n.dataset.feedId));
}
async function noOverlap(page) {
  const result = await page.locator(items).evaluateAll((nodes) => {
    const rects = nodes.map((el) => el.getBoundingClientRect());
    const grid = nodes[0]?.parentElement.getBoundingClientRect();
    return {
      inside: rects.every((r) => r.left >= grid.left - 0.5 && r.right <= grid.right + 0.5 && r.bottom <= grid.bottom + 0.5),
      overlap: rects.some((a, i) =>
        rects.slice(i + 1).some((b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)
      ),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(result.inside).toBe(true);
  expect(result.overlap, JSON.stringify(result)).toBe(false);
  expect(result.overflow).toBeLessThanOrEqual(1);
}

// Hold real effects at creation so interruption tests do not race the browser
// transport against a short visual interval. The production controller still
// owns cancellation and completion of these same native Animation objects.
async function holdFeedAnimations(page) {
  await page.evaluate(() => {
    const nativeAnimate = Element.prototype.animate;
    window.heldFeedAnimations = [];
    window.restoreFeedAnimate = () => {
      Element.prototype.animate = nativeAnimate;
    };
    Element.prototype.animate = function (...args) {
      const animation = Reflect.apply(nativeAnimate, this, args);
      if (this.matches("[data-feed-item]")) {
        animation.pause();
        window.heldFeedAnimations.push(animation);
      }
      return animation;
    };
  });
}

test("featured default preserves masthead and real links while laying out independent card heights", async ({ page }) => {
  await ready(page);
  await expect(page.locator("h1")).toHaveText("David Quispe");
  await expect(page.locator("[data-feed-view=featured]")).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toEqual(["spotlight", "writing-old", "writing-new", "project-old"]);
  await expect(page.locator("[data-feed-count]")).toHaveText("4 items");
  await expect(page.locator("[data-feed-empty]")).toBeHidden();
  await expect(page.locator("[data-feed-id=project-old] a")).toHaveAttribute("href", "/projects/old/");
  await noOverlap(page);
});

test("categories, accent-insensitive search and contextual empty state update without navigation", async ({ page }) => {
  await ready(page);
  let navigations = 0;
  page.on("request", (request) => {
    if (request.resourceType() === "document") navigations++;
  });
  await page.locator("[data-feed-view=writing]").click();
  await settled(page);
  expect(await ids(page)).toEqual(["writing-old", "writing-new"]);
  await page.locator("[data-feed-search]").fill("securite");
  await settled(page);
  expect(await ids(page)).toEqual(["writing-new"]);
  await expect(page).toHaveURL(/view=writing&q=securite/);
  await page.locator("[data-feed-search]").fill("<img src=x onerror=alert(1)>");
  await settled(page);
  await expect(page.locator("[data-feed-count]")).toHaveText("0 items");
  await expect(page.locator("[data-feed-empty]")).toBeVisible();
  await expect(page.locator("[data-feed-grid] img")).toHaveCount(0);
  await page.locator("[data-feed-toolbar] [data-feed-reset]").click();
  await settled(page);
  expect(await ids(page)).toHaveLength(4);
  await expect(page.locator("[data-feed-search]")).toBeFocused();
  await page.locator("[data-feed-view=papers]").click();
  await settled(page);
  await expect(page.locator("[data-feed-empty]")).toBeVisible();
  expect(await ids(page)).toEqual([]);
  expect(navigations).toBe(0);
});

test("sort really reorders semantic DOM and uses cancellable native FLIP", async ({ page }) => {
  await ready(page, "?view=all");
  expect(await ids(page)).toEqual(["writing-old", "writing-new", "project-old", "project-new", "project-middle"]);
  await holdFeedAnimations(page);
  await page.locator("[data-feed-sort]").selectOption("newest");
  await page.waitForFunction(() => window.heldFeedAnimations.length > 0);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "true");
  const animated = await page.locator(grid).evaluate((el) =>
    el.getAnimations({ subtree: true }).some((a) => {
      const frames = a.effect.getKeyframes();
      return frames.some((f) => f.transform) && frames[0].transform !== frames.at(-1).transform;
    })
  );
  expect(animated).toBe(true);
  await page.evaluate(() => {
    window.restoreFeedAnimate();
    window.heldFeedAnimations.forEach((animation) => animation.play());
  });
  await settled(page);
  expect(await ids(page)).toEqual(["writing-new", "project-new", "project-middle", "writing-old", "project-old"]);
  await noOverlap(page);
  await page.locator("[data-feed-sort]").selectOption("oldest");
  await settled(page);
  expect(await ids(page)).toEqual(["project-old", "writing-old", "project-middle", "project-new", "writing-new"]);
  await noOverlap(page);
});

test("interrupted exits and entries converge to latest category without stale hidden cards", async ({ page }) => {
  await ready(page, "?view=all");
  await holdFeedAnimations(page);
  await page.locator("[data-feed-view=writing]").click();
  await page.waitForFunction(() => window.heldFeedAnimations.length > 0);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "true");
  await page.evaluate(() => window.restoreFeedAnimate());
  await page.locator("[data-feed-view=projects]").click();
  await page.locator("[data-feed-view=all]").click();
  await settled(page);
  expect(await ids(page)).toHaveLength(5);
  expect(await page.evaluate(() => window.heldFeedAnimations.every((animation) => animation.playState === "idle"))).toBe(true);
  await expect(page.locator("[data-feed-grid] [data-feed-visible=true][hidden]")).toHaveCount(0);
  await expect(page.locator("[data-feed-grid] [data-feed-visible=true][inert]")).toHaveCount(0);
  await noOverlap(page);
});

test("URL deep links preserve unrelated parameters/hash and restore state with browser back", async ({ page }) => {
  await ready(page, "?view=all&utm=profile#profile");
  await page.locator("[data-feed-view=projects]").click();
  await settled(page);
  await page.locator("[data-feed-sort]").selectOption("newest");
  await settled(page);
  await page.locator("[data-feed-search]").fill("recent");
  await settled(page);
  expect(await ids(page)).toEqual(["project-new"]);
  const url = new URL(page.url());
  expect(url.searchParams.get("utm")).toBe("profile");
  expect(url.hash).toBe("#profile");
  await page.goBack();
  await settled(page);
  await expect(page.locator("[data-feed-sort]")).toHaveValue("recommended");
  await expect(page.locator("[data-feed-search]")).toHaveValue("");
  expect(await ids(page)).toEqual(["project-old", "project-new", "project-middle"]);
  await page.goBack();
  await settled(page);
  expect(await ids(page)).toHaveLength(5);
  await page.goForward();
  await settled(page);
  await expect(page.locator("[data-feed-view=projects]")).toHaveAttribute("aria-pressed", "true");
});

test("native keyboard activation, rail links and focus recovery remain accessible", async ({ page }) => {
  await ready(page);
  await page.locator("[data-feed-view=all]").focus();
  await page.keyboard.press("Enter");
  await settled(page);
  await page.locator("[data-feed-id=project-old] a").focus();
  await page.locator("[data-feed-sort]").evaluate((select) => {
    select.value = "newest";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settled(page);
  await expect(page.locator("[data-feed-id=project-old] a")).toBeFocused();
  await page.evaluate(() => document.querySelector("[data-feed-view=writing]").click());
  await settled(page);
  await expect(page.locator("[data-feed-view=writing]")).toBeFocused();
  await page.locator("a[data-feed-link]").first().click();
  await settled(page);
  await expect(page.locator("[data-feed-view=projects]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("a[data-feed-link]").first()).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/view=projects/);
  await expect(page.locator("#external")).toHaveAttribute("href", "https://example.com/?view=writing");
});

test("responsive widths, loaded text metrics and dynamic card height never overlap", async ({ page }) => {
  await ready(page, "?view=all");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    await settled(page);
    await noOverlap(page);
    await expect(page.locator("[data-feed-item][data-feed-visible=true] [data-pretext]").first()).toHaveAttribute("data-pretext-ready", "true");
  }
  await page.locator("[data-feed-id=project-new] p").evaluate((el) => {
    el.textContent = "Updated editorial text that changes the card height. ".repeat(15);
  });
  await page.waitForTimeout(120);
  await settled(page);
  await noOverlap(page);
});

test("reduced motion is instant initially and cancels an in-flight reorder", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "?view=all");
  await page.locator("[data-feed-sort]").selectOption("newest");
  await settled(page);
  expect(await page.locator(grid).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await settled(page);
  // Hold actual native animations so an external browser command cannot miss
  // their short running interval on a busy machine. The production media
  // listener must cancel these same animations when the preference changes.
  await holdFeedAnimations(page);
  await page.locator("[data-feed-sort]").selectOption("oldest");
  await page.waitForFunction(() => window.heldFeedAnimations.length > 0);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settled(page);
  expect(await page.evaluate(() => window.heldFeedAnimations.every((animation) => animation.playState === "idle"))).toBe(true);
  await page.evaluate(() => window.restoreFeedAnimate());
  expect(await page.locator(grid).evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await ids(page)).toEqual(["project-old", "writing-old", "project-middle", "project-new", "writing-new"]);
  await noOverlap(page);
});

test("without JavaScript all source cards and links stay readable in fallback grid", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(fixture);
  await expect(page.locator("[data-feed-item]")).toHaveCount(6);
  for (const card of await page.locator("[data-feed-item]").all()) await expect(card).toBeVisible();
  await expect(page.locator("[data-feed-toolbar]")).toBeHidden();
  await expect(page.locator("[data-feed-id=project-old] a")).toHaveAttribute("href", "/projects/old/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await context.close();
});

test("optional scrollable writing becomes a named keyboard region only in that category", async ({ page }) => {
  await ready(page, "?view=writing");
  await expect(page.locator(grid)).toHaveAttribute("role", "region");
  await expect(page.locator(grid)).toHaveAttribute("aria-label", "Writing archive");
  await expect(page.locator(grid)).toHaveAttribute("tabindex", "0");
  await page.locator("[data-feed-search]").fill("no matching article");
  await settled(page);
  await expect(page.locator(grid)).not.toHaveAttribute("tabindex", "0");
  await page.locator("[data-feed-search]").fill("");
  await settled(page);
  await page.locator("[data-feed-view=all]").click();
  await settled(page);
  await expect(page.locator(grid)).not.toHaveAttribute("role", "region");
  await expect(page.locator(grid)).not.toHaveAttribute("tabindex", "0");
});

test("All deep links recover initially hidden source cards and preserve modified rail clicks", async ({ page }) => {
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const source = readFileSync(join(__dirname, "profile-feed-fixture.html"), "utf8")
    .replaceAll('data-feed-id="project-new"', 'hidden data-feed-id="project-new"')
    .replaceAll('data-feed-id="project-middle"', 'hidden data-feed-id="project-middle"');
  await page.route("**/tests/profile-feed-fixture.html*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: source }));
  await ready(page, "?view=all");
  expect(await ids(page)).toHaveLength(5);
  await expect(page.locator('[data-feed-id="project-new"]')).toBeVisible();
  const result = await page
    .locator("a[data-feed-link]")
    .first()
    .evaluate((link) => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 })));
  expect(result).toBe(true);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-current-view", "all");
});

test("resolved UI dictionary drives counts, category context and actionable empty copy", async ({ page }) => {
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const ui = {
    feed: {
      count_singular: "{count} result",
      count_plural: "{count} results",
      descriptions: { featured: "Selected highlights", all: "Complete archive", papers: "Research archive" },
      papers_empty_title: "Publication details pending",
      papers_empty_description: "Verified publication entries will be added here.",
      empty_title: "No results found",
      empty_description: "Clear the search to browse the archive.",
    },
  };
  const source = readFileSync(join(__dirname, "profile-feed-fixture.html"), "utf8").replace(
    "<head>",
    '<head><script type="application/json" id="portfolio-ui">' + JSON.stringify(ui) + "</script>"
  );
  await page.route("**/tests/profile-feed-fixture.html*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: source }));
  await ready(page);
  await expect(page.locator("[data-feed-count]")).toHaveText("4 results");
  await expect(page.locator("[data-feed-context]")).toHaveText("Selected highlights");
  await page.locator(".feed-tabs [data-feed-view=papers]").click();
  await settled(page);
  await expect(page.locator("[data-feed-empty-title]")).toHaveText("Publication details pending");
  await expect(page.locator("[data-feed-empty-description]")).toHaveText("Verified publication entries will be added here.");
  await page.locator("[data-feed-search]").fill("not-present");
  await settled(page);
  await expect(page.locator("[data-feed-empty-title]")).toHaveText("No results found");
  await page.locator("[data-feed-empty] [data-feed-reset]").click();
  await settled(page);
  expect(await ids(page)).toHaveLength(5);
  await expect(page.locator("[data-feed-search]")).toHaveValue("");
  await expect(page.locator("[data-feed-empty] [data-feed-reset]")).not.toHaveAttribute("aria-pressed");
  await expect(page.locator("[data-feed-context]")).toHaveText("Complete archive");
});

async function inspectFeedFrames(page) {
  await page.addInitScript(() => {
    window.feedFrames = { baseline: null, initial: [], entering: [] };
    const nativeFrame = window.requestAnimationFrame.bind(window);
    const rect = (element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const inspect = () => {
      const root = document.querySelector("[data-profile-feed]");
      const grid = root?.querySelector("[data-feed-grid]");
      if (!grid || !root.dataset.feedCurrentView) return;
      const visible = [...grid.children].filter((el) => el.matches('[data-feed-visible="true"]') && !el.hidden);
      if (!window.feedFrames.baseline && grid.dataset.feedEnhanced !== "true") {
        window.feedFrames.baseline = {
          height: innerHeight,
          cards: visible.map((el) => ({ id: el.dataset.feedId, ...rect(el), image: el.querySelector("img") ? rect(el.querySelector("img")) : null })),
        };
      }
      if (grid.dataset.feedEnhanced === "true" && root.dataset.feedReady !== "true") {
        window.feedFrames.initial.push(
          visible.map((el) => ({
            id: el.dataset.feedId,
            ...rect(el),
            opacity: getComputedStyle(el).opacity,
            image: el.querySelector("img") ? rect(el.querySelector("img")) : null,
          }))
        );
      }
      const entering = grid.querySelector('[data-feed-id="project-new"]');
      if (root.dataset.feedReady === "true" && root.dataset.feedCurrentView === "all" && entering && !entering.hidden && entering.inert) {
        window.feedFrames.entering.push({
          ...rect(entering),
          opacity: getComputedStyle(entering).opacity,
          inert: entering.inert,
          ariaHidden: entering.getAttribute("aria-hidden"),
          viewport: innerHeight,
        });
      }
    };
    window.requestAnimationFrame = (callback) =>
      nativeFrame((time) => {
        inspect();
        callback(time);
        inspect();
      });
  });
}

test("initial measurement frames preserve readable fallback positions and below-fold image bounds", async ({ page }) => {
  await inspectFeedFrames(page);
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const image =
    "data:image/svg+xml;base64," +
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="gray"/></svg>').toString(
      "base64"
    );
  const source = readFileSync(join(__dirname, "profile-feed-fixture.html"), "utf8")
    .replace("</style>", "[data-feed-item]{min-height:350px}[data-feed-item] img{display:block;width:100%;height:120px;object-fit:contain}</style>")
    .replaceAll("<h2>", `<img loading="lazy" width="240" height="120" src="${image}" alt="Original project image"><h2>`);
  await page.route("**/tests/profile-feed-fixture.html*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: source }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
  await settled(page);
  const frames = await page.evaluate(() => window.feedFrames);
  expect(frames.baseline.cards).toHaveLength(4);
  expect(frames.initial.length).toBeGreaterThanOrEqual(2);
  const below = frames.baseline.cards.filter((card) => card.image && card.image.y >= frames.baseline.height);
  expect(below.length).toBeGreaterThan(0);
  for (const frame of frames.initial) {
    expect(new Set(frame.map((card) => `${Math.round(card.x)},${Math.round(card.y)}`)).size).toBe(frame.length);
    for (const original of frames.baseline.cards) {
      const current = frame.find((card) => card.id === original.id);
      expect(current).toBeDefined();
      expect(Math.abs(current.x - original.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(current.y - original.y)).toBeLessThanOrEqual(1);
      expect(Number(current.opacity)).toBeGreaterThan(0);
    }
    for (const original of below) expect(frame.find((card) => card.id === original.id).image.y).toBeGreaterThanOrEqual(frames.baseline.height - 1);
  }
  await noOverlap(page);
});

test("newly entering cards stay transparent, inert and outside the viewport until measured commit", async ({ page }) => {
  await inspectFeedFrames(page);
  await ready(page);
  await page.locator(".feed-tabs [data-feed-view=all]").click();
  await settled(page);
  const frames = await page.evaluate(() => window.feedFrames.entering);
  expect(frames.length).toBeGreaterThanOrEqual(2);
  for (const frame of frames) {
    expect(Number(frame.opacity)).toBe(0);
    expect(frame.inert).toBe(true);
    expect(frame.ariaHidden).toBe("true");
    expect(frame.y).toBeGreaterThan(frame.viewport);
  }
  const card = page.locator('[data-feed-id="project-new"]');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute("inert");
  await expect(card).toHaveAttribute("aria-hidden", "false");
  expect(await card.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await noOverlap(page);
});

test("All-default catalog translates historical aliases without creating a Featured category", async ({ page }) => {
  const { readFileSync } = require("node:fs");
  const source = readFileSync(require("node:path").join(__dirname, "profile-feed-fixture.html"), "utf8")
    .replace('data-feed-default="featured"', 'data-feed-default="all"')
    .replace(/<button[^>]*data-feed-view="featured"[^>]*>.*?<\/button>/s, "")
    .replaceAll('data-feed-view="writing"', 'data-feed-view="blogs"')
    .replaceAll('data-feed-view="papers"', 'data-feed-view="research"');
  await page.route("**/tests/profile-feed-fixture.html*", (route) => route.fulfill({ status: 200, contentType: "text/html", body: source }));
  await ready(page);
  await expect(page.locator('[data-feed-view="all"]')).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toHaveLength(5);
  await ready(page, "?view=writing");
  await expect(page.locator('[data-feed-view="blogs"]')).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toEqual(["writing-old", "writing-new"]);
  await ready(page, "?view=papers");
  await expect(page.locator('[data-feed-view="research"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-feed-empty]")).toBeVisible();
  await ready(page, "?view=featured");
  await expect(page.locator('[data-feed-view="all"]')).toHaveAttribute("aria-pressed", "true");
  expect(await ids(page)).toHaveLength(5);
});
