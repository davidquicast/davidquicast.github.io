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
test("About keeps bounded desktop pages and native compact reading with the complete biography", async ({ page }) => {
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
    const compact = width <= 700 || height <= 520;
    if (compact) {
      await expect(reader).toHaveAttribute("data-about-mode", "scroll");
      const source = reader.locator("[data-about-source]");
      await expect(source).toBeVisible();
      await expect(reader.locator("[data-about-view]")).toBeHidden();
      await expect(reader.locator("[data-about-controls]")).toBeHidden();
      expect(await source.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      await source.locator("p").last().scrollIntoViewIfNeeded();
      await expect(source.locator("p").last()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      continue;
    }
    await expect(reader).toHaveAttribute("data-about-mode", "paged");
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

test("compact About uses native full-text scrolling at 200 percent text with intact rich links", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(new URL("/about/", base).href, { waitUntil: "networkidle" });
    const root = page.locator("[data-about-reader]");
    await expect(root).toHaveAttribute("data-about-mode", "scroll");
    const source = root.locator("[data-about-source]");
    const original = await source.innerHTML();
    const before = await root.locator("h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    const expectedLinks = await source.locator("a").evaluateAll((nodes) => nodes.map((anchor) => anchor.href));
    await page.evaluate(() => {
      const targets = [...document.querySelectorAll("body,body *")];
      const sizes = targets.map((element) => getComputedStyle(element).fontSize);
      targets.forEach((element, index) => (element.style.fontSize = `${parseFloat(sizes[index]) * 2}px`));
    });
    await expect.poll(() => root.locator("h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(before * 2);
    await expect(root.locator("[data-about-controls]")).toBeHidden();
    expect(await source.locator("a").evaluateAll((nodes) => nodes.map((anchor) => anchor.href))).toEqual(expectedLinks);
    // Inline font declarations are the only changes; no paging clone replaces the original rich DOM.
    expect(
      await source.evaluate((element) => {
        const clone = element.cloneNode(true);
        clone.querySelectorAll("[style]").forEach((node) => node.removeAttribute("style"));
        return clone.innerHTML;
      })
    ).toBe(original);
    expect(await source.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const download = root.locator(".about-reader-actions a[download]");
    await download.focus();
    await expect(download).toBeFocused();
    await expect(download).toBeInViewport();
    await expect(download).toHaveAttribute("href", "/assets/pdf/en-us/cv.pdf");
  }
});

test("short landscape About scrolls the original biography in direct and overlay views", async ({ page }) => {
  test.setTimeout(60000);
  for (const overlayMode of [false, true]) {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(new URL(overlayMode ? "/" : "/about/", base).href, { waitUntil: "networkidle" });
    if (overlayMode) await page.locator('.main-navigation a[href="/about/"]').click();
    const reader = page.locator("[data-about-reader]");
    await expect(reader).toHaveAttribute("data-about-ready", "true");
    await expect(reader).toHaveAttribute("data-about-mode", "scroll");
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll("body,body *")],
        sizes = nodes.map((element) => getComputedStyle(element).fontSize);
      nodes.forEach((element, index) => (element.style.fontSize = parseFloat(sizes[index]) * 2 + "px"));
    });
    await expect(reader.locator("[data-about-source]")).toBeVisible();
    await expect(reader.locator("[data-about-controls]")).toBeHidden();
    const download = reader.locator(".about-reader-actions a[download]");
    await download.focus();
    await expect(download).toBeInViewport();
    if (overlayMode) {
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("hidden");
      expect(await page.locator("[data-overlay-body]").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(page.locator(overlay)).not.toBeVisible();
    } else expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});

test("phone About overlays scroll natively by keyboard and retain CV actions and history", async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [320, 390]) {
    await home(page, width, 568);
    const about = page.locator('.main-navigation a[href="/about/"]');
    await about.focus();
    await page.keyboard.press("Enter");
    const reader = page.locator("[data-about-reader]");
    await expect(reader).toHaveAttribute("data-about-mode", "scroll");
    await expect(reader.locator("[data-about-controls]")).toBeHidden();
    await reader.focus();
    await page.keyboard.press("PageDown");
    await expect.poll(() => page.locator("[data-overlay-body]").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const lastParagraph = reader.locator("[data-about-source] p").last();
    await lastParagraph.scrollIntoViewIfNeeded();
    await expect(lastParagraph).toBeInViewport();
    const cv = reader.locator(".about-reader-actions a[data-content-overlay]");
    await cv.focus();
    await expect(cv).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/resume\/$/);
    await expect(page.locator("[data-overlay-body] .resume-preview-image").first()).toBeVisible();
    await page.goBack();
    await expect(reader).toHaveAttribute("data-about-mode", "scroll");
    await page.keyboard.press("Escape");
    await expect(page.locator(overlay)).not.toBeVisible();
    await expect(about).toBeFocused();
  }
});

test("About changes between desktop paging and compact native reading without losing source text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL("/about/", base).href, { waitUntil: "networkidle" });
  const reader = page.locator("[data-about-reader]");
  await expect(reader).toHaveAttribute("data-about-mode", "scroll");
  const source = reader.locator("[data-about-source]");
  const original = await source.innerHTML();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(reader).toHaveAttribute("data-about-mode", "paged");
  await expect(source).toBeHidden();
  await expect(reader.locator("[data-about-view]")).toBeVisible();
  await expect(reader.locator("[data-about-view]")).not.toBeEmpty();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(reader).toHaveAttribute("data-about-mode", "scroll");
  await expect(source).toBeVisible();
  expect(await source.innerHTML()).toBe(original);
  await expect(reader.locator("[data-about-view]")).toBeEmpty();
  await expect(reader.locator("[data-about-controls]")).toBeHidden();
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
