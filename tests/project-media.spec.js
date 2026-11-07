const { test, expect } = require("@playwright/test");
// Parse the same YAML format as Jekyll rather than relying on JSON-compatible formatting.
const media = JSON.parse(
  require("node:child_process").execFileSync(
    "ruby",
    ["-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.safe_load(File.read(ARGV.fetch(0))))", "_data/project_media.yml"],
    { encoding: "utf8" }
  )
);
const currentCounts = require("./real-content-counts.cjs");
const contentCounts = { writing: currentCounts.writing, papers: currentCounts.research };
const projectCount = Object.keys(media).length;
async function feedReady(page, path = "/") {
  await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const feed = page.locator("[data-profile-feed]");
  await expect(feed).toHaveAttribute("data-feed-ready", "true");
  await expect(feed).toHaveAttribute("data-feed-busy", "false");
  return feed;
}
async function selectView(page, view) {
  await page.locator(`.feed-tabs [data-feed-view="${view}"]`).click();
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-current-view", view);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
}
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL for the real Docker preview.");
test.beforeEach(async ({ page }) => {
  await page.route("**/*livereload*", (route) => route.abort());
});
test("every original project image is visible in the collection and its detail page", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL("/projects/", base).href);
  const cards = page.locator(".project-row");
  expect(await cards.count()).toBe(Object.keys(media).length);
  expect(await cards.evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().left))).size)).toBe(4);
  // Title links contain real plain text so Pretext calculates them, too.
  await expect.poll(() => cards.locator('.project-open[data-pretext-ready="true"]').count()).toBe(Object.keys(media).length);
  const links = await cards.locator(".project-open").evaluateAll((items) => items.map((item) => item.getAttribute("href")));
  for (let i = 0; i < links.length; i++) {
    const card = cards.nth(i),
      image = card.locator(".project-media img");
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
    const key = links[i].split("/").filter(Boolean).pop();
    expect(await image.getAttribute("alt")).toBe(media[key].alt);
    expect(await image.getAttribute("srcset")).toBe(media[key].srcset);
  }
  for (const href of links) {
    await page.goto(new URL(href, base).href, { waitUntil: "domcontentloaded" });
    const image = page.locator(".project-detail-media img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
});
test("profile sidebar typography, Pretext title geometry and original images remain intact at responsive widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await feedReady(page);
    const data = await page.evaluate(() => ({
      heading: parseFloat(getComputedStyle(document.querySelector(".profile-sidebar h1")).fontSize),
      family: getComputedStyle(document.querySelector("h1")).fontFamily,
      overflow: document.documentElement.scrollWidth - innerWidth,
      firstProjectTop: document.querySelector('[data-feed-kind="project"]').getBoundingClientRect().top,
      sidebar: (() => {
        const r = document.querySelector(".profile-sidebar").getBoundingClientRect();
        return { right: r.right, bottom: r.bottom };
      })(),
      catalog: (() => {
        const r = document.querySelector(".profile-catalog").getBoundingClientRect();
        return { left: r.left, top: r.top };
      })(),
      images: document.querySelectorAll("[data-feed-grid] .project-card .project-media img").length,
    }));
    expect(data.heading).toBe(22);
    expect(data.family).toContain("Inter");
    expect(data.overflow).toBeLessThanOrEqual(1);
    expect(data.images).toBe(projectCount);
    if (width === 1440) {
      expect(data.firstProjectTop).toBeLessThan(550);
      expect(data.sidebar.right).toBeLessThan(data.catalog.left);
    } else expect(data.sidebar.bottom).toBeLessThanOrEqual(data.catalog.top + 1);
    await expect.poll(() => page.locator('.project-open[data-pretext-ready="true"]').count()).toBe(projectCount);
    const titleBounds = await page.locator(".project-open[data-pretext]").evaluateAll((links) =>
      links.map((link) => {
        const box = link.closest("h2").getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(link);
        return {
          text: link.textContent,
          left: box.left,
          right: box.right,
          lines: [...range.getClientRects()].filter((r) => r.width > 0).map((r) => ({ left: r.left, right: r.right })),
        };
      })
    );
    for (const title of titleBounds) {
      expect(title.text.trim()).not.toBe("");
      expect(title.lines.length).toBeGreaterThan(0);
      for (const line of title.lines) {
        expect(line.left).toBeGreaterThanOrEqual(title.left - 1);
        expect(line.right).toBeLessThanOrEqual(title.right + 1);
      }
    }
  }
});
test("one profile feed presents every content type in independent non-overlapping columns", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const feed = await feedReady(page);
  await expect(feed).toHaveAttribute("data-feed-current-view", "all");
  await expect(feed.locator(".feed-tabs [data-feed-view]")).toHaveCount(4);
  const wall = feed.locator("[data-feed-grid]");
  await expect(wall.locator('[data-feed-kind="project"][data-feed-visible="true"]')).toHaveCount(projectCount);
  await expect(wall.locator('[data-feed-kind="writing"][data-feed-visible="true"]')).toHaveCount(contentCounts.writing);
  await expect(wall.locator('[data-feed-kind="paper"][data-feed-visible="true"]')).toHaveCount(contentCounts.papers);
  const geometry = await wall.locator(':scope > [data-feed-visible="true"]').evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
    })
  );
  expect(geometry).toHaveLength(projectCount + contentCounts.writing + contentCounts.papers);
  expect(new Set(geometry.map((rect) => Math.round(rect.left))).size).toBe(3);
  expect(new Set(geometry.map((rect) => Math.round(rect.height))).size).toBeGreaterThanOrEqual(4);
  for (let first = 0; first < geometry.length; first++) {
    for (let second = first + 1; second < geometry.length; second++) {
      const a = geometry[first],
        b = geometry[second];
      expect(
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
        `Cards ${first} and ${second} overlap`
      ).toBe(false);
    }
  }
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  const reader = page.locator("[data-content-overlay-dialog][open] [data-about-reader]");
  await expect(reader).toBeVisible();
  await expect(reader.locator("h1")).toHaveText("David Quispe");
  await expect(reader.locator("[data-about-view]")).toContainText(/Hi, I['’]m a systems engineer/);
  const personaxis = reader.locator("[data-about-view]").getByRole("link", { name: "Personaxis", exact: true });
  for (let attempt = 0; attempt < 12 && !(await personaxis.isVisible()); attempt++) {
    const next = reader.locator("[data-about-next]");
    if (await next.isDisabled()) break;
    await next.click();
  }
  await expect(personaxis).toBeVisible();
  await page.locator("[data-overlay-close]").click();
  await expect(page.locator("[data-content-overlay-dialog]")).not.toBeVisible();
});

test("native detail returns and universal Work/About navigation preserve catalog categories", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await feedReady(page, "/?view=projects");
  await expect(page.locator('[data-feed-kind="project"][data-feed-visible="true"]')).toHaveCount(projectCount);
  const projectHref = await page.locator('[data-feed-kind="project"][data-feed-visible="true"] .project-open').first().getAttribute("href");
  await page.goto(new URL(projectHref, base).href);
  const nav = page.locator("#main-navigation");
  await expect(nav.locator("a")).toHaveText(["Work", "About"]);
  await expect(nav.locator("a").first()).toHaveAttribute("href", "/");
  await expect(nav.locator("a").first()).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".project-detail > .back-link")).toHaveAttribute("href", "/?view=projects");
  await page.locator(".project-detail > .back-link").click();
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-current-view", "projects");
  await selectView(page, "blogs");
  const articleHref = await page.locator('[data-feed-kind="writing"][data-feed-visible="true"] h2 a').first().getAttribute("href");
  await page.goto(new URL(articleHref, base).href);
  await expect(page.locator(".editorial-post")).toBeVisible();
  await expect(nav.locator("a")).toHaveText(["Work", "About"]);
  await expect(page.locator(".editorial-post > .back-link")).toHaveAttribute("href", "/?view=writing");
  await page.locator(".editorial-post > .back-link").click();
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-current-view", "blogs");
  await selectView(page, "research");
  await expect(page).toHaveURL(/view=research/);
  await expect(page.locator('[data-feed-kind="project"][data-feed-visible="true"]')).toHaveCount(0);
  if (contentCounts.papers === 0) await expect(page.locator("[data-feed-empty]")).toBeVisible();
  await page.goto(new URL("/publications/", base).href);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Research");
  await expect(page.locator(".research-page > .back-link")).toHaveAttribute("href", "/?view=papers");
  await page.locator(".research-page > .back-link").click();
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-current-view", "research");
  await page.goto(new URL("/resume/", base).href);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Resume");
  await expect(nav.locator("a")).toHaveText(["Work", "About"]);
  await expect(nav.locator('a[href="/about/"]')).toHaveAttribute("aria-current", "page");
  await page.goto(base);
  await page.setViewportSize({ width: 844, height: 390 });
  for (const link of await nav.locator("a").all()) await expect(link).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".site-header [data-search-open]")).toHaveCount(0);
  // Chromium nearest-edge scrolling rounds a fractional bottom to a whole pixel.
  // Center the actual control, then require its complete visible area.
  await page.locator("[data-feed-search]").evaluate((input) => input.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect(page.locator("[data-feed-search]")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".theme-toggle")).toBeInViewport({ ratio: 1 });
  // The ordinary detail shell still exposes global search without duplicating
  // the profile's catalog search.
  await page.goto(new URL(projectHref, base).href);
  await expect(page.locator(".site-header [data-search-open]")).toBeInViewport({ ratio: 1 });
});

test("blog uses the full three-column canvas without the retired narrow profile cap", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(new URL("/blog/", base).href, { waitUntil: "networkidle" });
  const cards = page.locator(".journal-list > .writing-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  const data = await cards.evaluateAll((items) => ({
    columns: new Set(items.map((item) => Math.round(item.getBoundingClientRect().left))).size,
    right: Math.max(...items.map((item) => item.getBoundingClientRect().right)),
  }));
  expect(data.columns).toBe(Math.min(count, 3));
  expect(data.right).toBeGreaterThan(1200);
});
