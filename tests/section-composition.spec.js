const { test, expect } = require("@playwright/test");
const contentCounts = require("./real-content-counts.cjs");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");

const visibleCards = "[data-feed-item][data-feed-visible=true]";
async function settled(page) {
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
}
async function home(page, width = 1440, query = "") {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(new URL("/" + query, base).href, { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
  await settled(page);
}
async function columns(page) {
  return page.locator(visibleCards).evaluateAll((cards) => new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size);
}
async function choose(page, view, count, expectedColumns) {
  await page.locator(`[data-feed-view=${view}]`).click();
  await settled(page);
  await expect(page.locator(visibleCards)).toHaveCount(count);
  expect(await columns(page), `${view} column count`).toBe(expectedColumns);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test("section filters use four project columns, three blog columns and one research row on desktop", async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [1440, 1280]) {
    await home(page, width);
    expect(await columns(page)).toBe(5);
    await choose(page, "projects", contentCounts.projects, 4);
    expect(new URL(page.url()).searchParams.get("view")).toBe("projects");
    await page.reload({ waitUntil: "networkidle" });
    await settled(page);
    expect(await columns(page)).toBe(4);
    await choose(page, "blogs", contentCounts.writing, 3);
    await choose(page, "research", contentCounts.research, 1);
  }
  await home(page);
  expect(await columns(page)).toBe(5);
  const paperThumbnails = await page
    .locator(`${visibleCards}.paper-card .research-card-media`)
    .evaluateAll((media) => media.map((element) => element.getBoundingClientRect().width));
  expect(paperThumbnails.length).toBe(contentCounts.researchCovers.length);
  expect(paperThumbnails.every((width) => width <= 80)).toBe(true);
});

test("section density adapts to tablet and phone without clipping content or introducing hidden-card ghosts", async ({ page }) => {
  test.setTimeout(60000);
  for (const [width, columnCount] of [
    [768, 2],
    [390, 1],
    [320, 1],
  ]) {
    await home(page, width);
    await choose(page, "projects", contentCounts.projects, columnCount);
    await choose(page, "blogs", contentCounts.writing, columnCount);
    await choose(page, "research", contentCounts.research, 1);
    const hidden = await page
      .locator("[data-feed-item][data-feed-visible=false]")
      .evaluateAll((cards) =>
        cards.filter((card) => !card.hidden || !card.inert || card.getAttribute("aria-hidden") !== "true").map((card) => card.textContent)
      );
    expect(hidden).toEqual([]);
  }
});

test("research rows halve desktop height with uniform square artwork and readable full-width phone titles", async ({ page }) => {
  test.setTimeout(120000);
  for (const width of [1440, 1001, 768, 701, 700, 641, 581, 390, 320]) {
    await home(page, width, "?view=research");
    const allCards = page.locator(visibleCards);
    await expect(allCards).toHaveCount(contentCounts.research);
    const cards = allCards.filter({ has: page.locator(".research-card-media img") });
    await expect(cards).toHaveCount(contentCounts.researchCovers.length);
    const rows = [];
    for (const card of await cards.all()) {
      const image = card.locator("img").first();
      await expect(image).toBeAttached();
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element) => element.decode());
      const properties = await image.evaluate((element) => ({
        loaded: element.complete && element.naturalWidth > 0,
        width: Number(element.getAttribute("width")),
        height: Number(element.getAttribute("height")),
        alt: element.alt,
        src: element.currentSrc,
      }));
      expect(properties.loaded).toBe(true);
      expect(properties.width).toBeGreaterThan(0);
      expect(properties.height).toBeGreaterThan(0);
      expect(properties.width / properties.height).toBeCloseTo(1, 2);
      expect(properties.alt.trim().length).toBeGreaterThan(12);
      expect(new URL(properties.src).origin).toBe(new URL(base).origin);
      expect(new URL(properties.src).pathname).toMatch(/\.(?:webp|avif)$/u);
      expect(properties.src).not.toContain(".local/");
      const media = await image.boundingBox(),
        title = await card.locator("h2 a").boundingBox(),
        row = await card.boundingBox();
      const information = await card.locator(width > 700 ? ".wall-card-body" : ".paper-card-kicker").boundingBox();
      expect(Math.abs(media.width - media.height)).toBeLessThan(1);
      if (width > 700) {
        expect(media.width).toBe(88);
        expect(row.height).toBeLessThanOrEqual(108);
        expect(Math.abs(media.height - information.height)).toBeLessThan(1);
        expect(media.x + media.width).toBeLessThanOrEqual(title.x - 4);
        expect(Math.abs(information.y - media.y)).toBeLessThan(1);
      } else {
        expect(media.width).toBe(56);
        expect(Math.abs(information.y - media.y)).toBeLessThan(1);
        expect(title.y).toBeGreaterThanOrEqual(media.y + media.height);
      }
      expect(media.y).toBeLessThan(row.y + row.height);
      expect(title.x + title.width).toBeLessThanOrEqual(row.x + row.width + 1);
      rows.push({ ...row, y: row.y + (await page.evaluate(() => scrollY)) });
    }
    for (let index = 1; index < rows.length; index++) {
      expect(Math.abs(rows[index].x - rows[0].x)).toBeLessThan(1);
      expect(Math.abs(rows[index].width - rows[0].width)).toBeLessThan(1);
      if (width > 700) expect(Math.abs(rows[index].height - rows[0].height)).toBeLessThan(1);
      expect(rows[index].y).toBeGreaterThanOrEqual(rows[index - 1].y + rows[index - 1].height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("research readers retain filter geometry, working citations and shareable URL/history after density changes", async ({ page }) => {
  await home(page, 1440, "?view=research&sort=updated");
  const initialURL = page.url();
  await page.evaluate(() => (window.sectionDocumentIdentity = "retained"));
  const link = page.locator(visibleCards).first().locator("h2 a");
  const target = new URL(await link.getAttribute("href"), base).pathname;
  const citation = page.locator(visibleCards).first().locator(".paper-citation");
  expect(new URL(await citation.getAttribute("href"), base).pathname).toMatch(/\.bib$/u);
  await link.click();
  await expect(page.locator("[data-overlay-body] .paper-detail")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(target);
  expect(await page.evaluate(() => window.sectionDocumentIdentity)).toBe("retained");
  await page.goBack();
  await expect(page.locator("[data-content-overlay-dialog]")).not.toBeVisible();
  await settled(page);
  expect(page.url()).toBe(initialURL);
  expect(await columns(page)).toBe(1);
  await expect(page.locator("[data-feed-sort]")).toHaveValue("updated");
  await page.goForward();
  await expect(page.locator("[data-overlay-body] .paper-detail")).toBeVisible();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-content-overlay-dialog]")).not.toBeVisible();
  await expect(page.locator("#main .paper-detail h1")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(target);
});

test("rapid filter changes finish at the requested column mode with sorted semantic order and no stale cards", async ({ page }) => {
  await home(page);
  await page.evaluate(() => {
    window.sectionDocumentIdentity = "retained";
    for (const view of ["projects", "research", "blogs", "all", "projects"]) {
      document.querySelector(`[data-feed-view=${view}]`).click();
    }
    const sort = document.querySelector("[data-feed-sort]");
    sort.value = "updated";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settled(page);
  await expect(page.locator(visibleCards)).toHaveCount(contentCounts.projects);
  expect(await columns(page)).toBe(4);
  expect(await page.evaluate(() => window.sectionDocumentIdentity)).toBe("retained");
  const state = await page.locator("[data-feed-item]").evaluateAll((cards) => ({
    visible: cards
      .filter((card) => card.dataset.feedVisible === "true")
      .map((card) => ({
        kind: card.dataset.feedKind,
        activity: Number(card.dataset.feedActivity),
        hidden: card.hidden,
        inert: card.inert,
      })),
    ghosts: cards.filter((card) => card.dataset.feedVisible !== "true" && (!card.hidden || !card.inert)).length,
  }));
  expect(state.visible.every((card) => card.kind === "project" && !card.hidden && !card.inert)).toBe(true);
  expect(state.ghosts).toBe(0);
  const activities = state.visible.map((card) => card.activity);
  expect(activities).toEqual([...activities].sort((a, b) => b - a));
  expect(new URL(page.url()).searchParams.get("view")).toBe("projects");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("updated");
});

test("profile connections use compact desktop rows and retain touch targets on coarse-pointer phones", async ({ page, browser }) => {
  await home(page);
  const desktop = await page
    .locator(".profile-sidebar .profile-social-links .profile-social-link")
    .evaluateAll((links) =>
      links.map((link) => ({ x: link.getBoundingClientRect().x, y: link.getBoundingClientRect().y, height: link.getBoundingClientRect().height }))
    );
  expect(desktop.length).toBeGreaterThan(3);
  expect(desktop.every((link) => link.height >= 31 && link.height <= 36)).toBe(true);
  for (let index = 1; index < desktop.length; index++) {
    if (Math.abs(desktop[index].x - desktop[index - 1].x) < 1) {
      const gap = desktop[index].y - desktop[index - 1].y - desktop[index - 1].height;
      expect(gap).toBeGreaterThanOrEqual(-1);
      expect(gap).toBeLessThanOrEqual(8.01);
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const phone = await context.newPage();
    await phone.goto(base, { waitUntil: "networkidle" });
    await expect(phone.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
    const more = phone.locator("[data-profile-overflow] summary");
    if (await more.isVisible()) await more.click();
    const targets = await phone
      .locator(".profile-sidebar .profile-social-link")
      .evaluateAll((links) =>
        links.map((link) => ({ height: link.getBoundingClientRect().height, label: link.getAttribute("aria-label"), href: link.href }))
      );
    expect(targets.every((target) => target.height >= 44 && target.label && target.href)).toBe(true);
    const orcidLines = await phone.locator('a[href^="https://orcid.org/"] .profile-link-label').evaluate((label) => {
      const range = document.createRange();
      range.selectNodeContents(label);
      return range.getClientRects().length;
    });
    expect(orcidLines).toBe(1);
    expect(await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});

test("preserved archive routes follow the same section composition and paper covers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [path, selector, expectedColumns] of [
    ["/projects/", ".project-list > .wall-card", 4],
    ["/blog/", ".journal-list > .wall-card", 3],
  ]) {
    await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
    const actual = await page
      .locator(selector)
      .evaluateAll((cards) => new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size);
    expect(actual).toBe(expectedColumns);
  }
  await page.goto(new URL("/publications/", base).href, { waitUntil: "networkidle" });
  const papers = page.locator("[data-research-paper]");
  await expect(papers).toHaveCount(contentCounts.research);
  for (const paper of await papers.all()) {
    const image = paper.locator(".research-record-media img");
    if (!(await image.count())) continue;
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((node) => node.decode());
    const media = await image.boundingBox();
    const title = await paper.locator("h3").boundingBox();
    expect(media.x + media.width).toBeLessThan(title.x);
    expect(Math.abs(media.width - media.height)).toBeLessThan(1);
    const information = await paper.locator(".research-record-body").boundingBox();
    expect(Math.abs(media.height - information.height)).toBeLessThan(1);
  }
});

test("papers without optional artwork keep a full readable text row", async ({ page }) => {
  for (const width of [1440, 390]) {
    await home(page, width, "?view=research");
    const card = page.locator(visibleCards).first();
    await card.locator(".research-card-media").evaluate((node) => node.remove());
    await expect
      .poll(async () => {
        const row = await card.boundingBox();
        const title = await card.locator("h2").boundingBox();
        return title.width / row.width;
      })
      .toBeGreaterThan(0.8);
    await expect(card.locator("h2 a")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.goto(new URL("/publications/", base).href, { waitUntil: "networkidle" });
    const record = page.locator("[data-research-paper]").first();
    await record.locator(".research-record-media").evaluate((node) => node.remove());
    const row = await record.boundingBox();
    const title = await record.locator("h3").boundingBox();
    expect(title.width / row.width).toBeGreaterThan(0.8);
  }
});

test("paper resources stay below readable content with text enlarged to 200 percent", async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [320, 390, 768]) {
    await home(page, width, "?view=research");
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll("body *")]
        .filter((element) => !element.matches("svg,svg *,script,style"))
        .map((element) => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) if (size) element.style.fontSize = `${size * 2}px`;
    });
    await expect
      .poll(async () =>
        page.locator(visibleCards).evaluateAll((cards) =>
          cards.every((card) => {
            const body = card.querySelector(".wall-card-body");
            const actions = card.querySelector(".paper-card-actions");
            const preceding = [...body.children].filter(
              (element) => !element.matches(".paper-card-actions") && getComputedStyle(element).display !== "none"
            );
            return (
              preceding.at(-1).getBoundingClientRect().bottom <= actions.getBoundingClientRect().top + 1 &&
              (getComputedStyle(body).display === "contents" || body.scrollHeight <= body.clientHeight + 1)
            );
          })
        )
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
