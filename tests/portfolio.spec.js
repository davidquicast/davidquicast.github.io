const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { entrancesFinished } = require("./support/motion.cjs");
const base = process.env.PORTFOLIO_URL;
test.skip(!base, "Set PORTFOLIO_URL to audit the running Docker app.");
test.beforeEach(async ({ page }) => {
  await page.route("**/*livereload*", (route) => route.abort());
});

async function loaded(page, path) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded" });
  expect(response.status()).toBe(200);
  await page.waitForFunction(() => document.fonts.status === "loaded" && window.portfolioPretext?.snapshot().elements.length > 0);
  await expect(page.locator("h1")).toBeVisible();
  if (await page.locator("[data-profile-feed]").count()) {
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-ready", "true");
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
  }
}

async function measuredText(page) {
  return page.locator('[data-pretext-ready="true"]').evaluateAll((elements) =>
    elements
      .filter((element) => element.checkVisibility())
      .map((element) => {
        const wrapper = element.querySelector(".pretext-composition");
        const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
        const topPositions = new Set();
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (let offset = 0; offset < node.length; offset += 1) {
            if (!node.textContent[offset].trim()) continue;
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            for (const rect of range.getClientRects()) topPositions.add(Math.round(rect.top));
          }
        }
        return { text: element.textContent, predicted: Number(element.dataset.pretextLines), actual: topPositions.size };
      })
  );
}

test("live homepage, work, writing and detail surfaces preserve calculated text at responsive widths", async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loaded(page, "/");
  const details = await page.evaluate(() =>
    [
      document.querySelector(".frontpage-wall .project-open")?.getAttribute("href"),
      document.querySelector(".frontpage-wall .writing-card h2 a")?.getAttribute("href"),
    ].filter(Boolean)
  );
  expect(details).toHaveLength(2);
  const paths = ["/", "/about/", "/projects/", "/blog/", "/publications/", ...details];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await loaded(page, path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1);
      const measurements = await measuredText(page);
      expect(measurements.length).toBeGreaterThan(0);
      for (const item of measurements) expect(item.actual, `${path} ${width}: ${item.text}`).toBe(item.predicted);
    }
  }
  expect(errors).toEqual([]);
});

test("compact Work/About navigation supports keyboard, paginated biography and persisted theme", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loaded(page, "/");
  const originalURL = page.url();
  const nav = page.locator("#main-navigation");
  await expect(nav).toBeVisible();
  await expect(nav.locator("a")).toHaveText(["Work", "About"]);
  await expect(page.locator(".menu-toggle")).toHaveCount(0);
  const about = nav.getByRole("link", { name: "About", exact: true });
  await about.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("[data-content-overlay-dialog]");
  await expect(dialog).toBeVisible();
  const reader = dialog.locator("[data-about-reader]");
  await expect(reader).toHaveAttribute("data-about-ready", "true");
  const pages = Number(await reader.getAttribute("data-about-page-count"));
  expect(pages).toBeGreaterThan(0);
  if (pages > 1) {
    await reader.locator("[data-about-next]").click();
    await expect(reader).toHaveAttribute("data-about-current-page", "2");
    await reader.locator("[data-about-previous]").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(reader).toHaveAttribute("data-about-current-page", "1");
  }
  expect(await reader.locator("[data-about-view]").evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(originalURL);
  await expect(about).toBeFocused();
  const theme = page.locator(".theme-toggle");
  await theme.focus();
  await page.keyboard.press("Enter");
  const selected = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(selected);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selected);
});

test("live text remains available with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 850 } });
  const page = await context.newPage();
  await page.goto(base);
  await expect(page.locator("h1")).toHaveText("David Quispe");
  await expect(page.locator('.feed-fallback a[href="/projects/"]')).toBeVisible();
  await expect(page.locator("input[data-feed-search]")).toBeDisabled();
  const projectCount = await page.locator('[data-feed-item][data-feed-kind="project"]').count();
  // Reserve track widths even while only a prefix of streamed HTML is present.
  await page.setViewportSize({ width: 1440, height: 900 });
  const prefix = page.locator("[data-feed-grid] > [data-feed-item]:not([hidden])");
  const fullWidth = await prefix.first().evaluate((element) => element.getBoundingClientRect().width);
  await prefix.evaluateAll((items) =>
    items.slice(2).forEach((element) => {
      element.hidden = true;
    })
  );
  expect(await prefix.count()).toBe(2);
  expect(await prefix.first().evaluate((element) => element.getBoundingClientRect().width)).toBeCloseTo(fullWidth, 0);
  await page.locator('.feed-fallback a[href="/projects/"]').click();
  await expect(page.locator(".project-row")).toHaveCount(projectCount);
  await expect(page.locator(".project-row .project-open").first()).toHaveAttribute("href", /projects/);
  await context.close();
});

for (const [path, query] of [
  ["/projects/", "Personaxis"],
  ["/blog/", "memory"],
]) {
  test(`search on ${path} survives reload and recovers from an empty state`, async ({ page }) => {
    await loaded(page, path);
    const search = page.locator("[data-search]");
    const all = await page.locator("[data-filter-item]:visible").count();
    expect(all).toBeGreaterThan(0);
    await search.fill(query);
    await expect(page).toHaveURL(new RegExp("q=" + query));
    const matched = await page.locator("[data-filter-item]:visible").count();
    expect(matched).toBeGreaterThan(0);
    expect(matched).toBeLessThan(all);
    await page.reload();
    await expect(search).toHaveValue(query);
    await expect(page.locator("[data-filter-item]:visible")).toHaveCount(matched);
    await search.fill("unfindable-reference-849135");
    await expect(page.locator("[data-empty]")).toBeVisible();
    await expect(page.locator("[data-filter-item]:visible")).toHaveCount(0);
    await page.locator("[data-reset]").click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("");
    await expect(page.locator("[data-filter-item]:visible")).toHaveCount(all);
    await expect(page.locator("[data-empty]")).toBeHidden();
    await expect.poll(async () => (await measuredText(page)).filter((item) => item.actual !== item.predicted)).toEqual([]);
  });
}

test("combined writing filters keep URL state and reset all criteria", async ({ page }) => {
  await loaded(page, "/blog/");
  const root = page.locator("[data-filter-root]");
  const total = await root.locator("[data-filter-item]:visible").count();
  await root.locator('[data-filter="memory"]').click();
  await root.locator("[data-search]").fill("memory");
  await root.locator("select[data-year]").selectOption("2026");
  const matches = await root.locator("[data-filter-item]:visible").count();
  expect(matches).toBeGreaterThan(0);
  expect(matches).toBeLessThan(total);
  await page.reload();
  await expect(root.locator('[data-filter="memory"]')).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator("[data-search]")).toHaveValue("memory");
  await expect(root.locator("select[data-year]")).toHaveValue("2026");
  await root.locator("select[data-year]").selectOption("2025");
  await expect(root.locator("[data-empty]")).toBeVisible();
  await root.locator("[data-reset]").click();
  await expect(root.locator("[data-search]")).toHaveValue("");
  await expect(root.locator("[data-search]")).toBeFocused();
  await expect(root.locator("select[data-year]")).toHaveValue("all");
  await expect(root.locator('[data-filter="all"]')).toHaveAttribute("aria-pressed", "true");
  await expect(root.locator("[data-filter-item]:visible")).toHaveCount(total);
  expect(new URL(page.url()).search).toBe("");
});

test("profile content switches, date sorting and browser Back keep one document and exact URL state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loaded(page, "/");
  const feed = page.locator("[data-profile-feed]");
  const token = await page.evaluate(() => {
    window.profileAuditToken = Math.random();
    return window.profileAuditToken;
  });
  const navigations = [];
  const onRequest = (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
  };
  page.on("request", onRequest);
  await page.locator('.feed-tabs [data-feed-view="projects"]').click();
  await expect(feed).toHaveAttribute("data-feed-current-view", "projects");
  await page.locator("[data-feed-sort]").selectOption("newest");
  await page.locator("input[data-feed-search]").fill("vulnerability");
  await expect(feed).toHaveAttribute("data-feed-busy", "false");
  const projectURL = page.url();
  expect(new URL(projectURL).searchParams.get("sort")).toBe("newest");
  expect(new URL(projectURL).searchParams.get("q")).toBe("vulnerability");
  const dates = await page
    .locator('[data-feed-grid] > [data-feed-visible="true"]')
    .evaluateAll((items) => items.map((item) => Number(item.dataset.feedDate)));
  expect(dates.length).toBeGreaterThan(0);
  expect(dates.every(Number.isFinite)).toBe(true);
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
  await page.locator('.feed-tabs [data-feed-view="blogs"]').click();
  await expect(feed).toHaveAttribute("data-feed-current-view", "blogs");
  await page.goBack();
  await expect(page).toHaveURL(projectURL);
  await expect(feed).toHaveAttribute("data-feed-current-view", "projects");
  await expect(page.locator("[data-feed-sort]")).toHaveValue("newest");
  await expect(page.locator("input[data-feed-search]")).toHaveValue("vulnerability");
  await page.locator("input[data-feed-search]").fill("unfindable-profile-849135");
  await expect(page.locator("[data-feed-empty]")).toBeVisible();
  await page.locator("[data-feed-reset]").click();
  await expect(page.locator("input[data-feed-search]")).toHaveValue("");
  await expect(page.locator("input[data-feed-search]")).toBeFocused();
  await expect(page.locator("[data-feed-empty]")).toBeHidden();
  expect(await page.evaluate(() => window.profileAuditToken)).toBe(token);
  expect(navigations).toEqual([]);
  page.off("request", onRequest);
  // A real content-overlay round trip retains the same document and filtered URL.
  await loaded(page, projectURL);
  const retained = await page.evaluate(() => {
    window.detailRoundTripToken = Math.random();
    return window.detailRoundTripToken;
  });
  await page.locator('[data-feed-kind="project"][data-feed-visible="true"] .project-open').first().click();
  await expect(page.locator("[data-content-overlay-dialog]")).toBeVisible();
  expect(await page.evaluate(() => window.detailRoundTripToken)).toBe(retained);
  await expect(page.locator(".project-detail")).toBeVisible();
  await page.goBack();
  await expect(page.locator("[data-content-overlay-dialog]")).toBeHidden();
  expect(await page.evaluate(() => window.detailRoundTripToken)).toBe(retained);
  await expect(page).toHaveURL(projectURL);
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-current-view", "projects");
  await expect(page.locator("[data-feed-sort]")).toHaveValue("newest");
  await expect(page.locator("input[data-feed-search]")).toHaveValue("vulnerability");
});

test("article navigation and code copying operate on real content", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await loaded(page, "/blog/2025/shrink-wsl2-docker-virtual-disks/");
  const toc = page.locator("#article-toc a");
  expect(await toc.count()).toBeGreaterThan(1);
  const target = await toc.first().getAttribute("href");
  await toc.first().click();
  expect(new URL(page.url()).hash).toBe(target);
  await expect(page.locator(target)).toBeVisible();
  const code = page.locator("pre").first();
  const text = await code.textContent();
  const copy = page.locator(".copy-code").first();
  await copy.click();
  await expect(copy).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
});

test("main surfaces have no serious or critical axe findings in both themes at narrow widths", async ({ page }) => {
  test.setTimeout(180000);
  const violations = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 850 });
    for (const theme of ["light", "dark"]) {
      for (const path of ["/", "/projects/", "/blog/", "/blog/2025/shrink-wsl2-docker-virtual-disks/"]) {
        await loaded(page, path);
        await page.evaluate((next) => {
          document.documentElement.dataset.theme = next;
        }, theme);
        await entrancesFinished(page);
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        violations.push(
          ...result.violations
            .filter((item) => ["serious", "critical"].includes(item.impact))
            .map((item) => ({
              width,
              theme,
              path,
              id: item.id,
              impact: item.impact,
              nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
            }))
        );
      }
    }
  }
  expect(violations).toEqual([]);
});

test("real 200% text enlargement keeps main pages within 320px and 390px", async ({ page }) => {
  test.setTimeout(90000);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/about/", "/projects/", "/blog/", "/404.html", "/resume/"]) {
      await loaded(page, path);
      const before = await page.locator("h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll("body *")]
          .filter((element) => element instanceof HTMLElement)
          .map((element) => [element, parseFloat(getComputedStyle(element).fontSize)]);
        sizes.forEach(([element, size]) => {
          element.style.fontSize = size * 2 + "px";
        });
        window.portfolioPretext.refresh();
      });
      await page.waitForTimeout(400);
      const after = await page.locator("h1").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      expect(after).toBeCloseTo(before * 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), path + " at " + width).toBeLessThanOrEqual(1);
    }
  }
});

test("all article copy actions stay beside their own code block at narrow and wide widths", async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await loaded(page, "/blog/2025/shrink-wsl2-docker-virtual-disks/");
    const pairs = await page.locator(".copy-code").evaluateAll((buttons) =>
      buttons.map((button) => {
        const frame = button.closest(".code-frame");
        const pre = frame?.querySelector("pre");
        if (!frame || !pre) return { anchored: false };
        const bounds = frame.getBoundingClientRect();
        const action = button.getBoundingClientRect();
        const code = pre.getBoundingClientRect();
        return {
          anchored: button.offsetParent === frame,
          inside:
            action.left >= bounds.left - 1 && action.right <= bounds.right + 1 && action.top >= bounds.top - 1 && action.bottom <= bounds.bottom + 1,
          nearCode: Math.abs(action.top - code.top) < 60,
          belowArticleHeader: action.top > document.querySelector(".article-header").getBoundingClientRect().bottom,
        };
      })
    );
    expect(pairs.length).toBeGreaterThan(1);
    for (const pair of pairs) {
      expect(pair.anchored).toBe(true);
      expect(pair.inside).toBe(true);
      expect(pair.nearCode).toBe(true);
      expect(pair.belowArticleHeader).toBe(true);
    }
  }
});
