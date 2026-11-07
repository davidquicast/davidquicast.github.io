const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
const contentCounts = require("./real-content-counts.cjs");
test.skip(!base, "Set PORTFOLIO_URL to the real Docker build.");
async function settled(page) {
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
}
async function visit(page, suffix = "") {
  await page.goto(new URL("/" + suffix, base).href, { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
  await settled(page);
}
const visible = "[data-feed-item][data-feed-visible=true]";
test("identity, search and category labels each have one visible home location", async ({ page }) => {
  await visit(page);
  await expect(page.locator("img[src*='prof_pic']")).toHaveCount(1);
  await expect(page.locator(".site-header img, .profile-handle, .profile-about-actions")).toHaveCount(0);
  await expect(page.locator("[data-search-open]")).toHaveCount(0);
  await expect(page.locator("input[type=search]:visible")).toHaveCount(1);
  await expect(page.locator(".feed-tabs button")).toHaveText(["All", "Projects", "Blog", "Research"]);
  await expect(page.locator("[data-project-filters]")).toBeHidden();
  await expect(page.locator(".profile-resources a")).toHaveAttribute("href", "/resume/");
  await page.locator(".main-navigation a[href='/about/']").click();
  await expect(page.locator("[data-about-ready=true]")).toBeVisible();
  await expect(page.locator("[data-overlay-body] img")).toHaveCount(0);
  await expect(page.locator("[data-overlay-context]")).toHaveText("About");
  await expect(page.locator("[data-overlay-title]")).toHaveCSS("position", "absolute");
  await expect(page.locator("[data-overlay-title]")).toHaveCSS("clip", "rect(0px, 0px, 0px, 0px)");
  await expect(page.getByRole("dialog", { name: "David Quispe", exact: true })).toBeVisible();
  await expect(page.locator("[data-overlay-body] .section-label")).toHaveCount(0);
  await expect(page.locator("img[src*='prof_pic']")).toHaveCount(1);
});
test("original ownership groups combine with query and ordering without replacing the document", async ({ page }) => {
  await visit(page);
  await page.evaluate(() => {
    window.profileDocumentToken = "kept";
  });
  await page.locator("[data-feed-view=projects]").click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(19);
  await expect(page.locator("[data-project-filters]")).toBeVisible();
  await page.locator("[data-project-filter=independent]").click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(15);
  expect(await page.locator(visible).evaluateAll((nodes) => nodes.every((el) => el.dataset.feedProjectType === "independent"))).toBe(true);
  await page.locator("[data-project-filter=contributions]").click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(4);
  const urls = await page.locator(`${visible} .project-open`).evaluateAll((nodes) => nodes.map((el) => el.getAttribute("href")).sort());
  expect(urls).toEqual([
    "/projects/collab_01_synthetic_data_generator/",
    "/projects/collab_02_smol_course/",
    "/projects/collab_03_gemma_recipes/",
    "/projects/mcdaqc_16_sorry_bench_multilingual/",
  ]);
  await page.locator("[data-feed-sort]").selectOption("newest");
  await page.locator("[data-feed-search]").fill("Gemma");
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(1);
  await expect(page.locator(`${visible} .wall-meta`)).toContainText("Contribution");
  let url = new URL(page.url());
  expect(url.searchParams.get("project")).toBe("contributions");
  expect(url.searchParams.get("q")).toBe("Gemma");
  expect(url.searchParams.get("sort")).toBe("newest");
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(4);
  await expect(page.locator("[data-feed-search]")).toBeFocused();
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  expect(await page.evaluate(() => window.profileDocumentToken)).toBe("kept");
  await page.locator("[data-feed-view=all]").click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(contentCounts.all);
  expect(new URL(page.url()).searchParams.has("project")).toBe(false);
});
test("ownership deep links survive reload, back/forward and the contextual content reader", async ({ page }) => {
  await visit(page, "?view=projects&project=independent&utm_source=test");
  await expect(page.locator(visible)).toHaveCount(15);
  await page.locator("[data-project-filter=contributions]").click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(4);
  const address = page.url();
  const link = page.locator(`${visible} .project-open`).first();
  await link.click();
  await expect(page.locator("[data-content-overlay-dialog]")).toBeVisible();
  await page.locator("[data-overlay-close]").click();
  await expect(page.locator("[data-content-overlay-dialog]")).toBeHidden();
  expect(page.url()).toBe(address);
  await expect(page.locator(visible)).toHaveCount(4);
  await page.goBack();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(15);
  await page.goForward();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(4);
  await page.reload({ waitUntil: "networkidle" });
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(4);
  expect(new URL(page.url()).searchParams.get("utm_source")).toBe("test");
  await page.locator("[data-feed-view=blogs]").click();
  await settled(page);
  await expect(page.locator(visible)).toHaveCount(6);
  await expect(page.locator("[data-project-filters]")).toBeHidden();
  expect(new URL(page.url()).searchParams.has("project")).toBe(false);
});
test("catalog controls remain usable at narrow widths and 200 percent text", async ({ page }) => {
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [768, 1000],
    [896, 414],
  ]) {
    await page.setViewportSize({ width, height });
    await visit(page, "?view=projects&project=contributions");
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll("body *")]
        .filter((el) => !el.matches("svg,svg *,script,style"))
        .map((el) => [el, parseFloat(getComputedStyle(el).fontSize)]);
      for (const [el, size] of sizes) if (size) el.style.fontSize = `${size * 2}px`;
    });
    await settled(page);
    await page.locator("[data-project-filter=contributions]").scrollIntoViewIfNeeded();
    await expect(page.locator("[data-project-filter=contributions]")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.locator("[data-feed-search]").fill("Gemma");
    await settled(page);
    await expect(page.locator(visible)).toHaveCount(1);
    await page.getByRole("button", { name: "Clear search", exact: true }).click();
    await settled(page);
    await expect(page.locator(visible)).toHaveCount(4);
  }
});

test("preserved project archive combines original ownership and every authored topic", async ({ page }) => {
  await page.goto(new URL("/projects/?topic=collaborations", base).href, { waitUntil: "networkidle" });
  await expect(page.locator("[data-filter-item]:visible")).toHaveCount(4);
  await expect(page.locator("[data-filter=contributions]")).toHaveAttribute("aria-pressed", "true");
  const options = await page.locator("[data-project-topic] option").allTextContents();
  expect(options).toContain("gemma");
  expect(options).toContain("cybersecurity");
  expect(options).toContain("blockchain");
  await page.locator("[data-project-topic]").selectOption("gemma");
  await expect(page.locator("[data-filter-item]:visible")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("project")).toBe("contributions");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-project-topic]")).toHaveValue("gemma");
  await expect(page.locator("[data-filter-item]:visible")).toHaveCount(1);
  await page.locator("[data-filter=independent]").click();
  await expect(page.locator("[data-empty]")).toBeVisible();
  await page.locator("[data-reset]").click();
  await expect(page.locator("[data-filter-item]:visible")).toHaveCount(19);
  expect(new URL(page.url()).search).toBe("");
});
