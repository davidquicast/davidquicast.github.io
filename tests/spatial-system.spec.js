const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to the Docker preview.");
const routes = [
  "/",
  "/projects/",
  "/blog/",
  "/about/",
  "/resume/",
  "/publications/",
  "/projects/mcdaqc_00_personaxis/",
  "/blog/2025/shrink-wsl2-docker-virtual-disks/",
];
async function ready(page, path = "/") {
  await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator("[data-profile-feed]").count()) {
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
  }
}
async function frame(page) {
  return page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return { left: r.left, width: r.width, start: r.left + parseFloat(s.paddingLeft), end: r.right - parseFloat(s.paddingRight) };
    };
    const nav = document.querySelector(".main-navigation a");
    const range = document.createRange();
    range.selectNodeContents(nav);
    return {
      header: box(document.querySelector(".site-header-inner")),
      main: box(document.querySelector(".site-main")),
      footer: box(document.querySelector(".site-footer")),
      workTextLeft: range.getBoundingClientRect().left,
      overflow: document.documentElement.scrollWidth - innerWidth,
      workspace: document.querySelector("[data-profile-feed]")?.getBoundingClientRect().left,
    };
  });
}
test("header, content and footer share real aligned frames across routes and viewport sizes", async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1920, 1440, 1024, 896, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await ready(page, route);
      const f = await frame(page);
      for (const name of ["header", "footer"]) {
        expect(Math.abs(f[name].start - f.main.start), `${route} ${width} ${name} left`).toBeLessThan(1);
        expect(Math.abs(f[name].end - f.main.end), `${route} ${width} ${name} right`).toBeLessThan(1);
      }
      expect(Math.abs(f.workTextLeft - f.main.start), `${route} ${width} navigation optical edge`).toBeLessThan(1);
      expect(f.main.start).toBeGreaterThanOrEqual(24);
      expect(f.main.width).toBeLessThanOrEqual(1440);
      expect(f.overflow).toBeLessThanOrEqual(1);
      if (route === "/") expect(Math.abs(f.workspace - f.main.start)).toBeLessThan(1);
      if (route === "/resume/") {
        const aligned = await page.evaluate(() =>
          Math.abs(
            document.querySelector(".page-heading").getBoundingClientRect().left -
              document.querySelector(".resume-preview").getBoundingClientRect().left
          )
        );
        expect(aligned).toBeLessThan(1);
      }
    }
  }
});
test("profile identity, resources and reading scale stay cohesive instead of inheriting scattered defaults", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1920, 1440, 1000, 896, 768, 640, 600, 581, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    const m = await page.evaluate(() => {
      const $ = (s) => document.querySelector(s),
        rect = (s) => $(s).getBoundingClientRect(),
        size = (s) => parseFloat(getComputedStyle($(s)).fontSize);
      const cv = $(".profile-resources a"),
        walker = document.createTreeWalker(cv, NodeFilter.SHOW_TEXT);
      let node;
      while (walker.nextNode())
        if (walker.currentNode.textContent.trim()) {
          node = walker.currentNode;
          break;
        }
      const range = document.createRange();
      range.selectNodeContents(node);
      const handleRange = document.createRange();
      handleRange.selectNodeContents($('.profile-social-link[href*="github.com"] .profile-link-label'));
      return {
        handleLines: handleRange.getClientRects().length,
        avatar: rect(".profile-avatar").width,
        identityHeight: rect(".profile-person").height,
        // The optional availability signal sits between identity and biography.
        biographyGap:
          rect(".profile-bio").top - rect(document.querySelector(".profile-availability") ? ".profile-availability" : ".profile-person").bottom,
        name: size(".profile-name h1"),
        role: size(".profile-role"),
        bio: size(".profile-summary"),
        handle: size(".profile-social-link"),
        roleInIdentity: $(".profile-name").contains($(".profile-role")),
        nameCenter: rect(".profile-name").top + rect(".profile-name").height / 2,
        portraitCenter: rect(".profile-avatar").top + rect(".profile-avatar").height / 2,
        cvGap: range.getBoundingClientRect().left - cv.querySelector("svg").getBoundingClientRect().right,
        email: rect('.profile-social-link[href^="mailto:"]'),
        links: rect(".profile-social-links"),
      };
    });
    expect(m.avatar).toBe(64);
    expect(m.identityHeight).toBe(64);
    expect(m.biographyGap).toBe(24);
    expect(m.name).toBe(22);
    expect(m.role).toBe(13);
    expect(m.bio).toBe(14);
    expect(m.handle).toBe(13);
    expect(m.handleLines).toBe(1);
    expect(m.roleInIdentity).toBe(true);
    expect(Math.abs(m.nameCenter - m.portraitCenter)).toBeLessThan(1);
    expect(m.cvGap).toBeGreaterThanOrEqual(4);
    expect(m.cvGap).toBeLessThanOrEqual(12);
    if (width <= 580) {
      expect(Math.abs(m.email.left - m.links.left)).toBeLessThan(1);
      expect(Math.abs(m.email.right - m.links.right)).toBeLessThan(1);
    }
  }
});
test("sticky reading navigation keeps its summary below the real shared header", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "/blog/2025/shrink-wsl2-docker-virtual-disks/");
  await page.evaluate(() => scrollTo({ top: 1500, behavior: "instant" }));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m = await page.evaluate(() => ({
    header: document.querySelector(".site-header").getBoundingClientRect().bottom,
    outline: document.querySelector(".reading-sidebar summary").getBoundingClientRect().top,
    body: document.querySelector(".article-content").getBoundingClientRect().width,
    font: parseFloat(getComputedStyle(document.querySelector(".article-content")).fontSize),
  }));
  expect(m.outline).toBeGreaterThanOrEqual(m.header + 16);
  expect(m.body).toBeGreaterThan(450);
  expect(m.body).toBeLessThanOrEqual(700);
  expect(m.font).toBe(16);
});
test("the same frame and profile remain readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    for (const width of [1920, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base, { waitUntil: "networkidle" });
      const f = await frame(page);
      expect(Math.abs(f.workTextLeft - f.main.start)).toBeLessThan(1);
      expect(Math.abs(f.workspace - f.main.start)).toBeLessThan(1);
      expect(f.overflow).toBeLessThanOrEqual(1);
      await expect(page.locator(".profile-resources a")).toHaveAttribute("href", "/resume/");
      await expect(page.locator("img[src*=prof_pic]")).toHaveCount(1);
    }
  } finally {
    await context.close();
  }
});
