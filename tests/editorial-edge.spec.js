const { test, expect } = require("@playwright/test");
const fixture = "http://127.0.0.1:8091/";
const frames = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
async function ready(page) {
  await page.goto(fixture);
  await page.waitForFunction(() => document.querySelectorAll('[data-pretext-ready="true"]').length === 4);
  await frames(page);
}
async function actualLines(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const walker = document.createTreeWalker(el.querySelector(".pretext-composition") || el, NodeFilter.SHOW_TEXT);
    const ys = new Set();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (let i = 0; i < node.length; i++) {
        if (!node.textContent[i].trim()) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        for (const rect of range.getClientRects()) ys.add(Math.round(rect.top));
      }
    }
    return { actual: ys.size, predicted: Number(el.dataset.pretextLines) };
  });
}

test("inherited font changes invalidate metrics even when the target column stays the same width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot());
  await page.locator("main").evaluate((el) => {
    el.style.fontFamily = "monospace";
  });
  await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBeGreaterThan(before.preparations);
  await expect
    .poll(async () => {
      const result = await actualLines(page, "#dynamic");
      return result.actual === result.predicted;
    })
    .toBe(true);
});

test("text changed while hidden is recomposed after revealing the same column width", async ({ page }) => {
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot().preparations);
  await page.locator("main").evaluate((el) => {
    el.hidden = true;
  });
  await frames(page);
  await page.locator("#dynamic").evaluate((el) => {
    el.textContent =
      "Changed while hidden: a substantially longer editorial excerpt about accountable agent behavior, provenance, persistent memory and the practical limits of autonomous deployments.";
  });
  await frames(page);
  await page.locator("main").evaluate((el) => {
    el.hidden = false;
  });
  try {
    await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBeGreaterThan(before);
  } catch (error) {
    console.error(
      "Hidden mutation diagnostics",
      await page.evaluate(() => ({
        snapshot: window.portfolioPretext.snapshot(),
        markup: document.getElementById("dynamic").outerHTML,
        hidden: document.querySelector("main").hidden,
      }))
    );
    throw error;
  }
  await expect
    .poll(async () => {
      const result = await actualLines(page, "#dynamic");
      return result.actual === result.predicted;
    })
    .toBe(true);
});

test("mixed inline replacements preserve markup and discard obsolete measurement handles", async ({ page }) => {
  await ready(page);
  await page.locator("#dynamic").evaluate((el) => {
    el.innerHTML = '<em>New rich editorial content</em> with a retained <a href="#source">source link</a>.';
  });
  await expect(page.locator("#dynamic")).toHaveAttribute("data-pretext-ready", "native");
  await expect(page.locator("#dynamic em")).toHaveText("New rich editorial content");
  await expect(page.locator("#dynamic a")).toHaveAttribute("href", "#source");
  await expect(page.locator("#dynamic")).not.toHaveAttribute("data-pretext-lines");
  await page.locator("#dynamic").evaluate((el) => {
    el.textContent = "Plain text can opt into calculated composition again.";
    window.portfolioPretext.refresh();
  });
  await expect(page.locator("#dynamic")).toHaveAttribute("data-pretext-ready", "true");
  await expect
    .poll(async () => {
      const result = await actualLines(page, "#dynamic");
      return result.actual === result.predicted;
    })
    .toBe(true);
});

test("content insertion hooks work from document and window", async ({ page }) => {
  await ready(page);
  for (const target of ["document", "window"]) {
    await page.evaluate((target) => {
      const p = document.createElement("p");
      p.id = "inserted-" + target;
      p.dataset.pretext = "";
      p.textContent = "Inserted editorial text is composed by the shared layer.";
      document.querySelector("main").append(p);
      (target === "document" ? document : window).dispatchEvent(new Event("portfolio:content-updated"));
    }, target);
    await expect(page.locator("#inserted-" + target)).toHaveAttribute("data-pretext-ready", "true");
  }
});

test("resizing manual headline lines preserves the selected source characters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const selected = await page.locator("h1").evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = 45;
    const range = document.createRange();
    const first = walker.nextNode();
    range.setStart(first, 0);
    let node = first;
    while (node) {
      if (remaining <= node.length) {
        range.setEnd(node, remaining);
        break;
      }
      remaining -= node.length;
      node = walker.nextNode();
    }
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString().replace(/\s+/g, " ").trim();
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await frames(page);
  expect(await page.evaluate(() => getSelection().toString().replace(/\s+/g, " ").trim())).toBe(selected);
});

test("irrelevant ancestor color changes do not repeat numeric layout or preparation", async ({ page }) => {
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot());
  await page.locator("main").evaluate((el) => {
    el.style.color = "rgb(10, 20, 30)";
  });
  await frames(page);
  await frames(page);
  const after = await page.evaluate(() => window.portfolioPretext.snapshot());
  expect(after.preparations).toBe(before.preparations);
  expect(after.layouts).toBe(before.layouts);
});

test("late loaded inherited fonts settle on matching browser and calculated lines", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const face = new FontFace("Audit Local Slab", "url(/assets/fonts/editorial/zilla-slab-latin-400-normal.woff2)");
    document.fonts.add(face);
    document.querySelector("main").style.fontFamily = '"Audit Local Slab", serif';
    await face.load();
    await document.fonts.ready;
  });
  await expect
    .poll(async () => {
      const result = await actualLines(page, "#dynamic");
      return result.actual === result.predicted;
    })
    .toBe(true);
});

for (const recovery of ["resize", "refresh"]) {
  test(`Canvas failure keeps native content readable without retries and recovers by ${recovery}`, async ({ page }) => {
    await page.addInitScript(() => {
      const domContext = HTMLCanvasElement.prototype.getContext;
      const offscreenContext = OffscreenCanvas.prototype.getContext;
      window.canvasAttempts = 0;
      const blocked = function () {
        window.canvasAttempts += 1;
        return null;
      };
      HTMLCanvasElement.prototype.getContext = blocked;
      OffscreenCanvas.prototype.getContext = blocked;
      window.restoreCanvasContexts = () => {
        HTMLCanvasElement.prototype.getContext = domContext;
        OffscreenCanvas.prototype.getContext = offscreenContext;
      };
    });
    await page.goto(fixture);
    await page.waitForFunction(() => document.querySelectorAll('[data-pretext-ready="fallback"]').length === 4);
    await frames(page);
    const before = await page.evaluate(() => window.canvasAttempts);
    for (let index = 0; index < 4; index += 1) await frames(page);
    expect(await page.evaluate(() => window.canvasAttempts)).toBe(before);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Building practical AI systems with accountable agent behavior.");
    await expect(page.locator("h1")).not.toHaveAttribute("data-pretext-lines");
    await page.locator("#dynamic").evaluate((element) => {
      element.textContent = "Changed content stays current when text measurement is unavailable.";
    });
    await frames(page);
    await expect(page.locator("#dynamic")).toHaveText("Changed content stays current when text measurement is unavailable.");
    await page.evaluate(() => window.restoreCanvasContexts());
    if (recovery === "resize") await page.setViewportSize({ width: 390, height: 844 });
    else await page.evaluate(() => window.portfolioPretext.refresh());
    await page.waitForFunction(() => document.querySelectorAll('[data-pretext-ready="true"]').length === 4);
    await expect
      .poll(async () => {
        const result = await actualLines(page, "#dynamic");
        return result.actual === result.predicted;
      })
      .toBe(true);
  });
}

const base = process.env.PORTFOLIO_URL;
test.describe("live progressive enhancement", () => {
  test.skip(!base, "Set PORTFOLIO_URL to check the running portfolio.");
  test.beforeEach(async ({ page }) => {
    await page.route("**/*livereload*", (route) => route.abort());
  });
  test("essential compact navigation, theme and All feed survive a failed deferred app script", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/assets/js/portfolio.js*", (route) => route.abort());
    await page.goto(base);
    const nav = page.locator("#main-navigation");
    await expect(nav).toBeVisible();
    await expect(nav.locator("a")).toHaveText(["Work", "About"]);
    await expect(page.locator(".menu-toggle")).toHaveCount(0);
    const about = nav.getByRole("link", { name: "About", exact: true });
    await about.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-content-overlay-dialog]")).toBeVisible();
    await expect(page.locator("[data-overlay-body] [data-about-reader]")).toHaveAttribute("data-about-ready", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-content-overlay-dialog]")).toBeHidden();
    await expect(about).toBeFocused();
    const feed = page.locator("[data-profile-feed]");
    await expect(feed).toHaveAttribute("data-feed-current-view", "all");
    await page.locator('.feed-tabs [data-feed-view="projects"]').click();
    await expect(page).toHaveURL(/view=projects/);
    await expect(feed).toHaveAttribute("data-feed-busy", "false");
    const projects = await page.locator('[data-feed-item][data-feed-visible="true"]').count();
    expect(projects).toBeGreaterThan(5);
    await page.locator('.feed-tabs [data-feed-view="all"]').click();
    await expect(feed).toHaveAttribute("data-feed-current-view", "all");
    await expect(feed).toHaveAttribute("data-feed-busy", "false");
    expect(await page.locator('[data-feed-item][data-feed-visible="true"]').count()).toBeGreaterThan(projects);
    const theme = page.locator(".theme-toggle");
    const previous = await page.locator("html").getAttribute("data-theme");
    await theme.click();
    const chosen = previous === "dark" ? "light" : "dark";
    await expect(page.locator("html")).toHaveAttribute("data-theme", chosen);
    await page.goto(new URL("/projects/", base).href);
    await expect(page.locator("[data-search]")).toBeDisabled();
    expect(await page.locator("[data-filter-item]:visible").count()).toBeGreaterThan(5);
    await page.goto(base);
    await expect(feed).toHaveAttribute("data-feed-ready", "true");
    const project = page.locator('[data-feed-visible="true"] .project-open').first();
    await expect(project).toHaveAttribute("href", /\/projects\//);
    await expect(project).toHaveAttribute("data-pretext-ready", "true");
    await project.click();
    await expect(page.locator("[data-content-overlay-dialog] .project-detail")).toBeVisible();
    await expect(page.locator("[data-overlay-body] a[data-lightbox]").first()).toHaveAttribute("href", /\/assets\/img\//);
  });

  test("storage failure preserves system dark mode and session theme choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      for (const key of ["getItem", "setItem"])
        Object.defineProperty(Storage.prototype, key, {
          value() {
            throw new DOMException("Blocked", "SecurityError");
          },
        });
    });
    await page.goto(base);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".theme-toggle")).toHaveAttribute("aria-label", "Switch to light theme");
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
  test("without JavaScript collections remain complete and optional controls are honestly disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    await page.goto(new URL("/blog/", base).href);
    await expect(page.locator("[data-search]")).toBeDisabled();
    await expect(page.locator("select[data-year]")).toBeDisabled();
    expect(await page.locator("[data-filter-item]:visible").count()).toBeGreaterThan(0);
    await expect(page.locator('#main-navigation a[href="/"]')).toBeVisible();
    await context.close();
  });
});
