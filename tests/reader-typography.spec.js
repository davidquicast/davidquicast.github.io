const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
const fixture = "http://127.0.0.1:8091/tests/reader-typography-fixture.html";
async function styles(element) {
  return element.evaluate((node) => {
    const s = getComputedStyle(node);
    return {
      size: parseFloat(s.fontSize),
      weight: parseFloat(s.fontWeight),
      line: parseFloat(s.lineHeight),
      color: s.color,
      family: s.fontFamily,
      border: parseFloat(s.borderInlineStartWidth),
      background: s.backgroundColor,
      italic: s.fontStyle,
    };
  });
}
async function hierarchy(reader) {
  const h1 = await styles(reader.locator("h1").first());
  const h2 = await styles(reader.locator(".prose h2").first());
  const body = await styles(reader.locator(".prose p").first());
  expect(h1.size).toBeGreaterThan(h2.size);
  expect(h2.size).toBeGreaterThan(body.size);
  expect(h2.weight).toBeGreaterThan(body.weight);
  expect(body.line / body.size).toBeGreaterThanOrEqual(1.65);
  return { h1, h2, body };
}

test("semantic headings, quotes, references and code stay distinct across reader modes and themes", async ({ page }) => {
  test.setTimeout(60000);
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      for (const overlay of [false, true]) {
        await page.goto(fixture, { waitUntil: "networkidle" });
        await page.evaluate(
          ({ theme, overlay }) => {
            document.documentElement.dataset.theme = theme;
            document.querySelector("main").classList.toggle("content-overlay-body", overlay);
          },
          { theme, overlay }
        );
        const reader = page.locator(".editorial-post");
        const { h2, body } = await hierarchy(reader);
        const h3 = await styles(reader.locator("h3"));
        expect(h2.size).toBeGreaterThan(h3.size);
        expect(h3.size).toBeGreaterThan(body.size);
        const quote = await styles(reader.locator("blockquote"));
        expect(quote.border).toBeGreaterThanOrEqual(2);
        expect(quote.italic).toBe("italic");
        expect(quote.background).not.toBe("rgba(0, 0, 0, 0)");
        const reference = await styles(reader.locator(".references-list"));
        expect(reference.size).toBeLessThan(body.size);
        expect(reference.size).toBeGreaterThanOrEqual(13);
        const code = await styles(reader.locator("pre code"));
        expect(code.family).toMatch(/monospace|Consolas/u);
        expect(code.size).toBeLessThan(body.size);
        const contrast = await reader.locator("pre").evaluate((pre) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          const luminance = (color) => {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((channel) => {
              const v = channel / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          const background = luminance(getComputedStyle(pre).backgroundColor);
          return [...pre.querySelectorAll("span")].map((span) => {
            const foreground = luminance(getComputedStyle(span).color);
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
          });
        });
        expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
        await expect(reader.locator('a[href="#ref-1"]')).toHaveText("inline citation [1]");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("actual Blog, Project and Research pages retain the same hierarchy in direct and overlay readers", async ({ page }) => {
  test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    ["/blog/2022/instant-dark-theme-browser-devtools/", ".editorial-post", "blogs"],
    ["/projects/collab_01_synthetic_data_generator/", ".project-detail", "projects"],
    ["/research/include-2-0/", ".paper-detail", "research"],
  ];
  for (const [route, selector, view] of routes) {
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    const direct = await hierarchy(page.locator("#main " + selector));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.goto(new URL("/?view=" + view, base).href, { waitUntil: "networkidle" });
    await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
    await page.locator(`h2 a[data-content-overlay][href="${route}"]`).click();
    const reader = page.locator("[data-overlay-body] " + selector);
    await expect(reader).toBeVisible();
    const overlay = await hierarchy(reader);
    expect(overlay.h1.size).toBe(direct.h1.size);
    expect(overlay.h2.size).toBe(direct.h2.size);
    expect(overlay.body.size).toBe(direct.body.size);
    expect(new URL(page.url()).pathname).toBe(route);
  }
});

test("direct semantic reading hierarchy remains usable without JavaScript on narrow dark pages", async ({ browser }) => {
  test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "dark", viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage();
    for (const [route, selector] of [
      ["/blog/2022/instant-dark-theme-browser-devtools/", ".editorial-post"],
      ["/projects/collab_01_synthetic_data_generator/", ".project-detail"],
      ["/research/include-2-0/", ".paper-detail"],
    ]) {
      await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      await hierarchy(page.locator("#main " + selector));
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  } finally {
    await context.close();
  }
});
