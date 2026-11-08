const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { entrancesFinished } = require("./support/motion.cjs");
const base = process.env.PORTFOLIO_URL;
const contentCounts = require("./real-content-counts.cjs");
test.skip(!base, "Set PORTFOLIO_URL to the production Docker preview.");
const overlay = "[data-content-overlay-dialog]";
const cvPreview = require("../_data/resume_preview.json");
async function home(page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
  await settled(page);
}
async function settled(page) {
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
}
async function opened(page) {
  await expect(page.locator(overlay)).toBeVisible();
  await expect(page.locator("[data-overlay-body] h1")).toBeVisible();
}
async function close(page) {
  await page.locator("[data-overlay-close]").click();
  await expect(page.locator(overlay)).not.toBeVisible();
}
test("All groups actual content, highlights are marks, and usernames retain platform identity", async ({ page }) => {
  await home(page);
  await expect(page.locator("[data-feed-view]")).toHaveCount(4);
  await expect(page.locator("[data-feed-view=all]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-feed-view=featured]")).toHaveCount(0);
  await expect(page.locator("[data-feed-item]:not([hidden])")).toHaveCount(contentCounts.all);
  // Under the default "Featured" order the badge would only repeat the sort.
  await expect(page.locator(".featured-mark:visible")).toHaveCount(0);
  await page.locator("[data-feed-sort]").selectOption("newest");
  await settled(page);
  await expect(page.locator(".featured-mark").first()).toBeVisible();
  await page.locator("[data-feed-sort]").selectOption("recommended");
  await settled(page);
  const connections = await page.locator(".profile-social-link").evaluateAll((links) =>
    links.map((a) => ({
      text: a.textContent.trim(),
      href: a.href,
      label: a.getAttribute("aria-label"),
      icon: a.querySelector("img")?.getAttribute("src") || a.querySelector("svg")?.getAttribute("style"),
    }))
  );
  expect(connections.some((c) => c.text === "@davidquicast" && c.label.includes("GitHub"))).toBeTruthy();
  expect(connections.some((c) => c.text === "@davidquicast" && c.label.includes("Hugging Face"))).toBeTruthy();
  expect(connections.every((c) => c.href && !["GitHub", "LinkedIn", "Hugging Face"].includes(c.text))).toBeTruthy();
  for (const view of ["projects", "blogs", "research", "all"]) {
    await page.locator(`[data-feed-view=${view}]`).click();
    await settled(page);
    await expect(page.locator(`[data-feed-view=${view}]`)).toHaveAttribute("aria-pressed", "true");
    if (view !== "all") await expect(page.locator(".featured-mark:visible")).toHaveCount(0);
  }
  await expect(page.locator(".site-header .main-navigation a")).toHaveText(["Work", "About"]);
});
test("content overlays preserve document, filters, history and normal reloadable URLs", async ({ page }) => {
  await home(page);
  await page.evaluate(() => (window.documentIdentity = "retained"));
  await page.locator("[data-feed-view=projects]").click();
  await page.locator("[data-feed-sort]").selectOption("newest");
  await settled(page);
  const baseURL = page.url();
  const link = page.locator(".project-open:visible").first();
  const href = await link.getAttribute("href");
  await link.click();
  await opened(page);
  expect(new URL(page.url()).pathname).toBe(href);
  expect(await page.evaluate(() => window.documentIdentity)).toBe("retained");
  await expect(page.locator("[data-overlay-body] .project-destination").first()).toBeVisible();
  await page.goBack();
  await expect(page.locator(overlay)).not.toBeVisible();
  expect(page.url()).toBe(baseURL);
  await expect(page.locator("[data-feed-sort]")).toHaveValue("newest");
  await page.goForward();
  await opened(page);
  await close(page);
  expect(page.url()).toBe(baseURL);
  await link.click();
  await opened(page);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(overlay)).not.toBeVisible();
  await expect(page.locator("#main .project-detail h1")).toBeVisible();
  expect(await page.evaluate(() => window.documentIdentity)).toBeUndefined();
  await expect(page.locator(".site-header .main-navigation a")).toHaveText(["Work", "About"]);
});
test("overlay backdrop and nested gallery recover focus and the original board", async ({ page }) => {
  await home(page);
  const link = page.locator(".project-open").first();
  await link.click();
  await opened(page);
  await page.locator("[data-overlay-body] a[data-lightbox]").first().click();
  await expect(page.locator("#image-viewer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#image-viewer")).not.toBeVisible();
  await expect(page.locator(overlay)).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(page.locator(overlay)).not.toBeVisible();
  await expect(link).toBeFocused();
});
test("About fits viewport and pagination retains the entire original biography", async ({ page }) => {
  test.setTimeout(90000);
  for (const dimensions of [
    [1440, 900],
    [768, 900],
    [390, 844],
    [320, 568],
    [844, 390],
  ]) {
    const [width, height] = dimensions;
    await page.setViewportSize({ width, height });
    await page.goto(new URL("/about/", base).href, { waitUntil: "networkidle" });
    const reader = page.locator("[data-about-reader]");
    await expect(reader).toHaveAttribute("data-about-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    const original = await page.locator("[data-about-source]").textContent();
    const expected = original.match(/\S+/gu);
    const all = [];
    const count = Number(await reader.getAttribute("data-about-page-count"));
    expect(count).toBeGreaterThan(0);
    for (let n = 0; n < count; n++) {
      const view = page.locator("[data-about-view]");
      expect(await view.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      all.push(...((await view.textContent()).match(/\S+/gu) || []));
      if (n < count - 1) await page.locator("[data-about-next]").click();
    }
    expect(all.join(" ")).toBe(expected.join(" "));
    await expect(page.locator("[data-about-next]")).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
test("About to CV is one history stack and a direct CV stays a normal page", async ({ page }) => {
  await home(page, 390, 844);
  await page.locator('.main-navigation a[href="/about/"]').click();
  await opened(page);
  await expect(page.locator("[data-about-reader]")).toHaveAttribute("data-about-ready", "true");
  await page.locator("[data-overlay-body] .about-reader-actions [data-content-overlay]").click();
  await opened(page);
  const images = page.locator("[data-overlay-body] .resume-preview-image");
  await expect(images).toHaveCount(cvPreview.page_count);
  await images.first().evaluate((image) => image.decode());
  expect(await images.first().evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator("[data-overlay-body] object, [data-overlay-body] iframe")).toHaveCount(0);
  await images.first().locator("..").click();
  await expect(page.locator("#image-viewer")).toBeVisible();
  await page.locator("#image-viewer img").evaluate((image) => image.decode());
  await page.locator("#image-viewer").getByRole("button", { name: /Next/ }).click();
  await expect.poll(() => page.locator("#image-viewer img").evaluate((image) => image.currentSrc)).toContain(cvPreview.pages[1].image.src);
  await page.locator("#image-viewer img").evaluate((image) => image.decode());
  await page.keyboard.press("Escape");
  await expect(page.locator("#image-viewer")).not.toBeVisible();
  await expect(page.locator(overlay)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/resume/");
  await page.goBack();
  await expect(page.locator("[data-about-reader]")).toHaveAttribute("data-about-ready", "true");
  await close(page);
  expect(new URL(page.url()).pathname).toBe("/");
  await page.goto(new URL("/resume/", base).href);
  const directImages = page.locator("#main .resume-preview-image");
  await expect(directImages).toHaveCount(cvPreview.page_count);
  for (const image of await directImages.all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => element.decode());
    expect(await image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await page.locator(".resume-transcript summary").click();
  const transcript = await page.locator("[data-resume-text]").evaluateAll((nodes) => nodes.map((node) => node.textContent).join(" "));
  expect(transcript.replace(/\s+/gu, " ").trim()).toBe(
    cvPreview.pages
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim()
  );
  await expect(page.locator(overlay)).not.toBeVisible();
});
test("mounted project reader exposes no serious or critical accessibility findings", async ({ page }) => {
  await home(page, 390, 844);
  await page.locator(".project-open").first().click();
  await opened(page);
  await entrancesFinished(page);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact))).toEqual([]);
});

test("About recomposes at 200 percent text while keeping rich biography links", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(new URL("/about/", base).href, { waitUntil: "networkidle" });
  const root = page.locator("[data-about-reader]");
  await expect(root).toHaveAttribute("data-about-ready", "true");
  const before = await root.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.evaluate(() => {
    const targets = [...document.querySelectorAll("body,body *")];
    const sizes = targets.map((el) => getComputedStyle(el).fontSize);
    targets.forEach((el, index) => {
      el.style.fontSize = `${parseFloat(sizes[index]) * 2}px`;
    });
  });
  await expect.poll(() => root.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(before * 2);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const expectedLinks = await page.locator("[data-about-source] a").evaluateAll((nodes) => nodes.map((a) => a.href));
  const actualLinks = new Set();
  const count = Number(await root.getAttribute("data-about-page-count"));
  expect(count).toBeGreaterThan(1);
  for (let n = 0; n < count; n++) {
    const view = page.locator("[data-about-view]");
    expect(await view.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    for (const href of await view.locator("a").evaluateAll((nodes) => nodes.map((a) => a.href))) actualLinks.add(href);
    if (n < count - 1) await page.locator("[data-about-next]").click();
  }
  expect([...actualLinks].sort()).toEqual([...new Set(expectedLinks)].sort());
});

test("short landscape About retains readable enlarged lines in both normal and overlay views", async ({ page }) => {
  test.setTimeout(60000);
  for (const overlayMode of [false, true]) {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto(new URL(overlayMode ? "/" : "/about/", base).href, { waitUntil: "networkidle" });
    if (overlayMode) await page.locator('.main-navigation a[href="/about/"]').click();
    await expect(page.locator("[data-about-reader]")).toHaveAttribute("data-about-ready", "true");
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("body,body *")],
        sizes = nodes.map((el) => getComputedStyle(el).fontSize);
      nodes.forEach((el, index) => (el.style.fontSize = parseFloat(sizes[index]) * 2 + "px"));
    });
    await page.waitForTimeout(300);
    const view = page.locator("[data-about-view]");
    const measure = await view.evaluate((el) => ({
      height: el.clientHeight,
      line: parseFloat(getComputedStyle(el).lineHeight),
      overflow: el.scrollHeight - el.clientHeight,
    }));
    expect(measure.height).toBeGreaterThanOrEqual(measure.line);
    expect(measure.overflow).toBeLessThanOrEqual(1);
    if (overlayMode) {
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("hidden");
      expect(await page.locator("[data-overlay-body]").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    } else expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-about-next]")).toBeEnabled();
    await page.locator("[data-about-next]").click();
    await expect(page.locator("[data-about-reader]")).toHaveAttribute("data-about-current-page", "2");
  }
});

async function unchangedBackground(page) {
  await home(page);
  const before = await page
    .locator("#main [data-pretext]")
    .evaluateAll((nodes) => nodes.map((el) => ({ width: el.clientWidth, composition: el.dataset.pretextWidth, text: el.textContent })));
  await page.evaluate(() => {
    window.backgroundFeedChanges = 0;
    document.querySelector("[data-profile-feed]").addEventListener("portfolio:feed-change", () => window.backgroundFeedChanges++);
  });
  await page.locator(".project-open").first().click();
  await opened(page);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const during = await page
    .locator("#main [data-pretext]")
    .evaluateAll((nodes) => nodes.map((el) => ({ width: el.clientWidth, composition: el.dataset.pretextWidth, text: el.textContent })));
  expect(during).toEqual(before);
  const composed = await page.evaluate(() => window.portfolioPretext.snapshot().layouts);
  await close(page);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.backgroundFeedChanges)).toBe(0);
  expect(await page.evaluate(() => window.portfolioPretext.snapshot().layouts)).toBe(composed);
}
test("reader preserves background text geometry and never reapplies unchanged catalog history", async ({ page }) => {
  await unchangedBackground(page);
});
test("classic scrollbars retain the same background width through a reader round trip", async () => {
  const browser = await require("@playwright/test").chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    ignoreDefaultArgs: ["--hide-scrollbars"],
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(0);
    await unchangedBackground(page);
  } finally {
    await browser.close();
  }
});

test("server-rendered project media keeps its exact size when the catalog enhances", async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1210, 1212, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const pattern = "**/assets/js/profile-feed.js*";
    await page.route(pattern, async (route) => {
      await gate;
      await route.continue();
    });
    try {
      await page.goto(base, { waitUntil: "commit" });
      await expect(page.locator(".profile-sidebar h1")).toBeVisible();
      await page.waitForFunction(() => document.readyState !== "loading");
      await page.evaluate(() => document.fonts.ready);
      const image = page.locator(".profile-feed-grid .project-card .wall-media img").first();
      await image.evaluate((el) => el.decode());
      const before = await image.boundingBox();
      release();
      await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
      await settled(page);
      const after = await image.boundingBox();
      expect(Math.abs(after.width - before.width), `image width at ${width}`).toBeLessThan(0.5);
      expect(Math.abs(after.height - before.height), `image height at ${width}`).toBeLessThan(0.5);
    } finally {
      release();
      await page.unroute(pattern);
    }
  }
});

test("featured blog metadata stays clear of its visible action button", async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/?sort=newest", { waitUntil: "networkidle" });
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
    await settled(page);
    const card = page
      .locator(".profile-feed-grid .writing-card")
      .filter({ has: page.locator(".featured-mark") })
      .first();
    const feature = await card.locator(".featured-mark").boundingBox(),
      button = await card.locator("[data-card-menu]").boundingBox();
    expect(feature).not.toBeNull();
    expect(button).not.toBeNull();
    expect(
      feature.x < button.x + button.width &&
        feature.x + feature.width > button.x &&
        feature.y < button.y + button.height &&
        feature.y + feature.height > button.y
    ).toBe(false);
  }
});
