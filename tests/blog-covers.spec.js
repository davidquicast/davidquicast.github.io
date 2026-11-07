const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.PORTFOLIO_URL;
const manifest = JSON.parse(execFileSync("ruby", ["scripts/content-manifest.rb", process.cwd()], { encoding: "utf8" }));
const covers = JSON.parse(
  execFileSync("ruby", ["-ryaml", "-rjson", "-e", "puts JSON.generate(YAML.safe_load_file(ARGV[0]))", "_data/blog_covers.yml"], { encoding: "utf8" })
);
const published = manifest.posts.filter((post) => post.published);
function postPath(post) {
  return post.permalink || manifest.permalink.replace(":year", post.year).replace(":title", post.slug);
}
async function visit(page, route) {
  await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const feed = page.locator("[data-profile-feed]");
  if (await feed.count()) {
    await expect(feed).toHaveAttribute("data-feed-ready", "true");
    await expect(feed).toHaveAttribute("data-feed-busy", "false");
  }
}
async function decodedCover(image) {
  await expect(image).toBeVisible();
  await image.scrollIntoViewIfNeeded();
  const data = await image.evaluate(async (element) => {
    await element.decode();
    return {
      loaded: element.complete && element.naturalWidth > 0,
      alt: element.alt,
      width: element.clientWidth,
      height: element.clientHeight,
      source: new URL(element.currentSrc).pathname,
      reservedWidth: Number(element.getAttribute("width")),
      reservedHeight: Number(element.getAttribute("height")),
    };
  });
  expect(data.loaded).toBe(true);
  expect(data.alt.trim().length).toBeGreaterThan(12);
  expect(data.width).toBeGreaterThan(0);
  expect(data.height).toBeGreaterThan(0);
  expect(data.reservedWidth).toBeGreaterThan(0);
  expect(data.reservedHeight).toBeGreaterThan(0);
  expect(data.source).toMatch(/^\/assets\/img\/editorial\/.+\.webp$/u);
  return data;
}

test("every published article and private draft has complete optimized editorial cover assets", () => {
  for (const post of manifest.posts) {
    const cover = covers[post.slug];
    expect(cover, post.slug).toBeTruthy();
    expect(cover.alt.trim().length, post.slug).toBeGreaterThan(12);
    const sources = [...new Set([cover.image, cover.thumbnail, ...cover.srcset.split(",").map((entry) => entry.trim().split(/\s+/u)[0])])];
    expect(sources.length).toBe(3);
    for (const source of sources) {
      const asset = path.join(process.cwd(), source);
      expect(fs.existsSync(asset), source).toBe(true);
      expect(fs.statSync(asset).size, source).toBeGreaterThan(0);
    }
  }
});

test("All, the Blog filter and Blog archive show an actual cover on every published article", async ({ page }) => {
  test.skip(!base, "Set PORTFOLIO_URL to the production Docker preview.");
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/?view=blogs", "/blog/"]) {
      await visit(page, route);
      const cards = page.locator(".writing-card");
      await expect(cards).toHaveCount(published.length);
      for (const card of await cards.all()) {
        const image = card.locator(".writing-image img");
        await expect(image).toHaveCount(1);
        const data = await decodedCover(image);
        const link = await card.locator("h2 a").getAttribute("href");
        const post = published.find((entry) => postPath(entry) === link);
        expect(post, link).toBeTruthy();
        expect(data.source).toContain(post.slug);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test("year, tag and category archives retain the same real editorial covers", async ({ page }) => {
  test.skip(!base, "Set PORTFOLIO_URL to the production Docker preview.");
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/blog/2022/", "/blog/2025/", "/blog/2026/", "/blog/tag/ai-safety/", "/blog/category/notes/"]) {
    await visit(page, route);
    const cards = page.locator(".writing-card");
    expect(await cards.count(), route).toBeGreaterThan(0);
    for (const card of await cards.all()) await decodedCover(card.locator(".writing-image img"));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("every published article detail retains its eager editorial cover and title", async ({ page }) => {
  test.skip(!base, "Set PORTFOLIO_URL to the production Docker preview.");
  test.setTimeout(60000);
  for (const post of published) {
    await visit(page, postPath(post));
    await expect(page.locator(".article-header h1")).toHaveText(post.title);
    const image = page.locator(".article-cover img");
    const data = await decodedCover(image);
    expect(data.source).toContain(post.slug);
    await expect(image).toHaveAttribute("loading", "eager");
  }
});
