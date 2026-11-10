const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const base = process.env.PORTFOLIO_URL;
const portrait = JSON.parse(
  execFileSync("ruby", ["-rjson", "-ryaml", "-e", "puts JSON.generate(YAML.safe_load_file(ARGV[0]))", "_data/profile_image.yml"], {
    encoding: "utf8",
  })
);
test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");

function localAsset(assetPath) {
  return path.join(process.cwd(), assetPath);
}

test("profile avatar selects a complete resized photograph at standard and high pixel densities", async ({ browser }) => {
  test.setTimeout(60000);
  for (const density of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: density });
    try {
      const page = await context.newPage();
      const requests = [];
      page.on("request", (request) => {
        if (request.resourceType() === "image") requests.push(new URL(request.url()).pathname);
      });
      await page.goto(base, { waitUntil: "networkidle" });
      const avatar = page.locator("img.profile-avatar");
      await expect(avatar).toHaveCount(1);
      await expect(avatar).toHaveAttribute("loading", "eager");
      await expect(avatar).toHaveAttribute("fetchpriority", "high");
      await expect(avatar).toHaveAttribute("width", "64");
      await expect(avatar).toHaveAttribute("height", "64");
      const actual = await avatar.evaluate(async (image) => {
        await image.decode();
        const bitmap = await createImageBitmap(await (await fetch(image.currentSrc)).blob());
        const result = {
          src: new URL(image.currentSrc).pathname,
          width: bitmap.width,
          height: bitmap.height,
          displayedWidth: image.getBoundingClientRect().width,
          displayedHeight: image.getBoundingClientRect().height,
        };
        bitmap.close();
        return result;
      });
      await expect(avatar).toHaveCSS("object-fit", "contain");
      await avatar.hover();
      await expect(avatar).toHaveCSS("scale", "none");
      const variant = portrait.variants.find((item) => item.path === actual.src);
      expect(variant).toBeTruthy();
      expect(actual.width).toBe(variant.width);
      expect(actual.height).toBe(variant.height);
      expect(actual.width).toBeGreaterThanOrEqual(portrait.display_size * density);
      expect(actual.displayedWidth).toBe(portrait.display_size);
      expect(actual.displayedHeight).toBe(portrait.display_size);
      expect(requests).not.toContain(portrait.source);
    } finally {
      await context.close();
    }
  }
});

test("supplied portrait stays unchanged and remains visible without JavaScript with its actual social image", async ({ browser }) => {
  const source = fs.readFileSync(localAsset(portrait.source));
  expect(crypto.createHash("sha256").update(source).digest("hex")).toBe(portrait.source_sha256);
  expect(portrait.avatar_crop).toBeNull();
  // The supplied complete photograph is scaled, never zoomed on hover.
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    const avatar = page.locator("img.profile-avatar");
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute("alt", portrait.alt);
    await expect(avatar).toHaveAttribute("srcset", portrait.srcset);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(new URL(ogImage).pathname).toBe(portrait.og.path);
    const response = await context.request.get(new URL(portrait.og.path, base).href);
    expect(response.ok()).toBe(true);
    const jpeg = await response.body();
    expect(jpeg.subarray(0, 2).toString("hex")).toBe("ffd8");
    expect(jpeg.length).toBe(portrait.og.bytes);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});
