const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const counts = require("./real-content-counts.cjs");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL for the Docker production preview.");
const records = [
  { id: "include-2-0", match: "INCLUDE-2.0", relationship: "coauthor" },
  { id: "culturalriddles", match: "CulturalRiddles", relationship: "coauthor" },
  { id: "somos600m", match: "Somos600M", relationship: "cited_work" },
  { id: "rigochat-2", match: "RigoChat 2", relationship: "cited_work" },
];
async function home(page) {
  await page.goto(base + "/?view=research", { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
  await expect(page.locator("[data-feed-view=research]")).toHaveAttribute("aria-pressed", "true");
}
test("real research cards distinguish coauthorship, pending authorship and citations of work", async ({ page }) => {
  await home(page);
  await expect(page.locator("[data-feed-kind=paper][data-feed-visible=true]")).toHaveCount(4);
  await expect(page.locator("[data-feed-kind=paper][data-research-relationship=coauthor]")).toHaveCount(2);
  await expect(page.locator("[data-feed-kind=paper][data-research-relationship=cited_work]")).toHaveCount(2);
  for (const r of records) {
    const card = page.locator(".paper-card").filter({ has: page.locator("h2", { hasText: r.match }) });
    await expect(card).toHaveAttribute("data-research-relationship", r.relationship);
    expect((await card.locator(".paper-authors").innerText()).length).toBeLessThan(180);
    if (r.relationship === "cited_work") {
      await expect(card.locator(".wall-meta")).toContainText("Cites my work");
      await expect(card).toHaveAttribute("data-feed-featured", "false");
    }
  }
  await expect(page.locator(".paper-card").filter({ hasText: "CulturalRiddles" }).locator(".research-status")).toContainText(
    "Author-list update pending"
  );
  await expect(page.locator(".featured-mark:visible")).toHaveCount(0);
  await page.locator("[data-feed-view=all]").click();
  await expect(page.locator("[data-feed-visible=true]")).toHaveCount(counts.all);
});
test("all four paper readers preserve static URLs, canonical author lists and downloadable citations", async ({ page, request }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await home(page);
  for (const r of records) {
    // Each iteration deliberately tests a full-page reload before returning home.
    await page.evaluate(() => (window.researchDocumentToken = "retained"));
    await page.locator(".paper-card h2 a").filter({ hasText: r.match }).click();
    const dialog = page.locator("[data-content-overlay-dialog]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".paper-detail")).toHaveAttribute("data-research-relationship", r.relationship);
    expect(new URL(page.url()).pathname).toBe("/research/" + r.id + "/");
    expect(await page.evaluate(() => window.researchDocumentToken)).toBe("retained");
    const download = dialog.locator('a[download][href$=".bib"]');
    const citationURL = new URL(await download.getAttribute("href"), base);
    expect(citationURL.origin).toBe(new URL(base).origin);
    expect(citationURL.pathname).toBe("/assets/bib/" + r.id + ".bib");
    const response = await request.get(citationURL.href);
    expect(response.status()).toBe(200);
    const bib = await response.text();
    if (r.id === "include-2-0") {
      expect(bib).toMatch(/^@inproceedings/);
      expect(bib).toContain("David Quispe-Castillo");
      expect(bib).toContain("30643");
      expect(bib).toContain("30666");
    }
    if (r.id === "culturalriddles") {
      expect(bib).not.toContain("David Quispe-Castillo");
      await expect(dialog.locator(".research-status")).toContainText(/awaiting an update|update pending/);
      await expect(dialog.locator(".research-relationship-note")).toContainText("David Quispe-Castillo");
    }
    if (r.relationship === "cited_work") {
      expect(bib).not.toContain("David Quispe-Castillo");
      await expect(dialog.locator(".research-mentions li")).toHaveCount(r.id === "somos600m" ? 2 : 1);
    }
    const authorDetails = dialog.locator(".research-author-list");
    if (await authorDetails.count()) {
      await authorDetails.locator("summary").click();
      await expect(authorDetails.locator("p")).toBeVisible();
    }
    await page.locator("[data-overlay-close]").click();
    await expect(dialog).not.toBeVisible();
    expect(new URL(page.url()).searchParams.get("view")).toBe("research");
    await page.goto(base + "/research/" + r.id + "/", { waitUntil: "networkidle" });
    await expect(page.locator(".paper-detail")).toBeVisible();
    await expect(page.locator("[data-content-overlay-dialog]")).not.toBeVisible();
    const graph = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.flatMap((e) => JSON.parse(e.textContent)["@graph"] || []));
    const pub = graph.find((e) => e["@type"] === "ScholarlyArticle");
    expect(pub).toBeTruthy();
    if (r.id === "culturalriddles") expect(pub.author.map((a) => a.name)).not.toContain("David Quispe-Castillo");
    await home(page);
  }
});
test("academic identities use supplied profile links and remain readable at breakpoint widths", async ({ page }) => {
  for (const width of [1440, 768, 640, 600, 581, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await home(page);
    const group = page.locator(".profile-research-links");
    await expect(group.locator("a")).toHaveCount(3);
    await expect(group.getByRole("link", { name: /ORCID/ })).toHaveAttribute("href", "https://orcid.org/0009-0004-6602-2218");
    await expect(group.getByRole("link", { name: /Google Scholar/ })).toHaveAttribute("href", /user=G8ea1KMAAAAJ/);
    await expect(group.getByRole("link", { name: /OpenReview/ })).toHaveAttribute(
      "href",
      "https://openreview.net/profile?id=~David_Quispe-Castillo1"
    );
    await expect(group).not.toContainText("G8ea1KMAAAAJ");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator("img[src*=prof_pic]")).toHaveCount(1);
  }
});
test("research search keeps coauthored and cited-work sections distinct and global search finds papers", async ({ page }) => {
  await page.goto(base + "/publications/", { waitUntil: "networkidle" });
  await expect(page.locator("[data-research-paper]")).toHaveCount(4);
  const input = page.locator("[data-research-search]");
  await expect(input).toBeEnabled();
  await input.fill("KUNTUR");
  await expect(page.locator("[data-research-paper]:visible")).toHaveCount(1);
  await expect(page.locator("[data-research-paper]:visible")).toHaveAttribute("id", "somos600m");
  await expect(page.locator("[data-research-group]").filter({ has: page.locator("#coauthored-research") })).not.toBeVisible();
  await input.fill("");
  await expect(page.locator("[data-research-paper]:visible")).toHaveCount(4);
  await page.keyboard.press("Control+k");
  await expect(page.locator("[data-search-dialog]")).toBeVisible();
  await page.locator("[data-global-search-input]").fill("INCLUDE-2.0");
  await page.locator(".search-result").filter({ hasText: "INCLUDE-2.0" }).first().click();
  await expect(page.locator("[data-overlay-body] .paper-detail")).toBeVisible();
});
test("paper records retain meaningful static content and citations without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(base + "/publications/");
    await expect(page.locator("#coauthored-research")).toBeVisible();
    await expect(page.locator("#cited-research")).toBeVisible();
    await expect(page.locator("[data-research-paper]")).toHaveCount(4);
    await page.goto(base + "/research/somos600m/");
    await expect(page.locator(".research-mentions li")).toHaveCount(2);
    await expect(page.locator('a[download][href$=".bib"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});
test("populated research archive and pending-paper reader have no serious accessibility findings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/publications/", { waitUntil: "networkidle" });
  let report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(report.violations.filter((v) => ["serious", "critical"].includes(v.impact))).toEqual([]);
  await page.locator(".research-paper h3 a").filter({ hasText: "CulturalRiddles" }).click();
  await expect(page.locator("[data-overlay-body] .paper-detail")).toBeVisible();
  report = await new AxeBuilder({ page }).include("[data-content-overlay-dialog]").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(report.violations.filter((v) => ["serious", "critical"].includes(v.impact))).toEqual([]);
});

test("reader text retains full contrast during the entrance animation in both themes", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ reducedMotion: "no-preference", colorScheme });
    await page.goto(base + "/publications/", { waitUntil: "networkidle" });
    // Stretch the actual CSS animation so the audit cannot race its completion.
    await page.addStyleTag({ content: ".content-overlay[open] { animation-duration: 10s !important; }" });
    await page.locator(".research-paper h3 a").filter({ hasText: "CulturalRiddles" }).click();
    await expect(page.locator("[data-overlay-body] .paper-detail")).toBeVisible();
    const dialog = page.locator("[data-content-overlay-dialog]");
    const held = await dialog.evaluate((element) => {
      const animations = element.getAnimations().filter((animation) => animation.animationName === "reader-enter");
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = Number(animation.effect.getComputedTiming().duration) * 0.1;
      }
      return animations.length;
    });
    expect(held).toBe(1);
    await expect(dialog).toHaveCSS("opacity", "1");
    const report = await new AxeBuilder({ page }).include("[data-content-overlay-dialog]").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(report.violations.filter((violation) => ["serious", "critical"].includes(violation.impact))).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  }
});
