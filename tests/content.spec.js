const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const site = path.resolve(process.env.PRODUCTION_SITE || ".local/production");
const publicPosts = [
  "/blog/2022/instant-dark-theme-browser-devtools/",
  "/blog/2025/shrink-wsl2-docker-virtual-disks/",
  "/blog/2025/private-synthetic-data-generation/",
  "/blog/2026/the-problem-with-a-persona-that-cannot-refuse/",
  "/blog/2026/ai-personas-are-not-masks/",
  "/blog/2026/the-axis-between-memory-and-agency/",
];
const draftSlugs = [
  "your-ai-has-a-midlife-crisis-because-you-gave-it-memory",
  "the-weird-grief-of-losing-an-ai-that-never-existed",
  "the-day-your-agent-deletes-the-database-and-apologizes-beautifully",
  "personas-are-becoming-the-new-passwords",
  "benchmarks-are-fanfiction-with-numbers",
  "why-ai-girlfriends-understand-product-market-fit-better-than-enterprise-agents",
];
const removedSamples = [
  "news/announcement_1.md/index.html",
  "news/announcement_2.md/index.html",
  "news/announcement_3.md/index.html",
  "assets/html/relativity.html",
  "assets/jupyter/blog.ipynb",
  "assets/jupyter/blog.ipynb.html",
  "assets/plotly/demo.html",
  "assets/json/resume_en-us.json",
  "assets/json/resume_en-us_sample.json",
  "assets/json/resume_pt-br.json",
  "assets/pdf/pt-br/example_pdf.pdf",
];
function read(relative) {
  const filename = path.join(site, relative);
  expect(fs.existsSync(filename), "Build the isolated production site before running content tests: " + filename).toBe(true);
  return fs.readFileSync(filename, "utf8");
}

test("production feed identifies the author and retains published articles without drafts", async ({ page }) => {
  const feed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return {
      errors: doc.querySelectorAll("parsererror").length,
      title: doc.documentElement.querySelector(":scope > title")?.textContent,
      authors: [...doc.querySelectorAll("author > name")].map((e) => e.textContent),
      urls: [...doc.querySelectorAll("entry > link")].map((e) => e.getAttribute("href")),
    };
  }, read("feed.xml"));
  expect(feed.errors).toBe(0);
  expect(feed.title).toBe("David Quispe");
  expect(feed.authors.length).toBeGreaterThanOrEqual(publicPosts.length);
  expect(feed.authors.every((name) => name === "David Quispe")).toBe(true);
  for (const url of publicPosts) {
    expect(feed.urls).toContain("https://davidquicast.github.io" + url);
    expect(fs.existsSync(path.join(site, url, "index.html"))).toBe(true);
  }
  for (const slug of draftSlugs) {
    expect(feed.urls.some((url) => url.includes(slug))).toBe(false);
    expect(fs.existsSync(path.join(site, "blog/2026", slug, "index.html"))).toBe(false);
  }
});

test("production sitemap and output exclude original theme samples while retaining real projects", async ({ page }) => {
  const sitemap = read("sitemap.xml");
  const urls = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return [...doc.querySelectorAll("url > loc")].map((e) => e.textContent);
  }, sitemap);
  for (const sample of removedSamples) {
    expect(fs.existsSync(path.join(site, sample)), sample + " must remain source-only").toBe(false);
    expect(urls.some((url) => url.includes(sample.replace("/index.html", "/")))).toBe(false);
  }
  for (const slug of draftSlugs) expect(sitemap.includes(slug)).toBe(false);
  for (const filename of fs
    .readdirSync("_projects/en-us")
    .filter(
      (file) =>
        file.endsWith(".md") && !/^published:\s*false\s*$/m.test(fs.readFileSync(path.join("_projects/en-us", file), "utf8").split("---")[1] || "")
    )) {
    const project = "/projects/" + filename.slice(0, -3) + "/";
    expect(fs.existsSync(path.join(site, project, "index.html")), project).toBe(true);
    expect(urls).toContain("https://davidquicast.github.io" + project);
  }
});

test("archive metadata distinguishes years, tags and categories", async ({ page }) => {
  const routes = ["blog/2022/", "blog/tag/web-development/", "blog/category/web-development/"];
  const titles = [];
  for (const route of routes) {
    const meta = await page.evaluate(
      (html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return {
          title: doc.title.trim().replace(/\s+/g, " "),
          description: doc.querySelector('meta[name="description"]')?.content,
          canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute("href"),
          ogTitle: doc.querySelector('meta[property="og:title"]')?.content,
        };
      },
      read(route + "index.html")
    );
    titles.push(meta.title);
    expect(meta.title).toContain(route.includes("2022") ? "2022" : "web development");
    expect(meta.title).not.toContain("David Quispe · David Quispe");
    expect(meta.description).toContain("David Quispe");
    expect(meta.ogTitle).toContain("Blog");
    expect(meta.ogTitle).not.toContain("Blogs");
    expect(meta.canonical).toBe("https://davidquicast.github.io/" + route);
  }
  expect(new Set(titles).size).toBe(routes.length);
});

test("external article offers a native link without requiring JavaScript or timed navigation", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setContent(read("blog/2025/private-synthetic-data-generation/index.html"));
  const link = page.getByRole("link", { name: "Read the full article on Hugging Face", exact: true });
  await expect(link).toBeVisible();
  await expect(page.locator(".article-byline")).not.toContainText("min read");
  await expect(link).toHaveAttribute("href", "https://huggingface.co/blog/davidquicast/private-synthetic-data-generation");
  await expect(page.locator('meta[http-equiv="refresh" i]')).toHaveCount(0);
  await context.close();
});

test("resume renders actual PDF pages and exact extracted text without JavaScript", async ({ browser }) => {
  const crypto = require("node:crypto");
  const preview = JSON.parse(fs.readFileSync("_data/resume_preview.json", "utf8"));
  const pdf = fs.readFileSync(path.join(site, "assets/pdf/en-us/cv.pdf"));
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(crypto.createHash("sha256").update(pdf).digest("hex")).toBe(preview.source.sha256);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const mime = {
    ".html": "text/html",
    ".css": "text/css",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".pdf": "application/pdf",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  await context.route("https://cv-preview.test/**", async (route) => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const filename = path.resolve(site, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
    if (!filename.startsWith(site + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) return route.abort();
    await route.fulfill({ body: fs.readFileSync(filename), contentType: mime[path.extname(filename)] || "application/octet-stream" });
  });
  const page = await context.newPage();
  await page.goto("https://cv-preview.test/resume/", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Open PDF", exact: false })).toHaveAttribute("href", "/assets/pdf/en-us/cv.pdf");
  const download = page.getByRole("link", { name: "Download PDF", exact: false });
  await expect(download).toHaveAttribute("href", "/assets/pdf/en-us/cv.pdf");
  await expect(download).toHaveAttribute("download", "");
  await expect(page.locator("object,iframe")).toHaveCount(0);
  const images = page.locator(".resume-preview-image");
  await expect(images).toHaveCount(preview.page_count);
  for (const [index, image] of (await images.all()).entries()) {
    await image.scrollIntoViewIfNeeded();
    const decoded = await image.evaluate(async (element) => {
      await element.decode();
      // naturalWidth is density-corrected for a width-descriptor srcset.
      // Decode the selected resource to verify its actual pixel dimensions.
      const bitmap = await createImageBitmap(await (await fetch(element.currentSrc)).blob());
      const result = {
        visible: element.complete && element.naturalWidth > 0,
        path: new URL(element.currentSrc).pathname,
        width: bitmap.width,
        height: bitmap.height,
      };
      bitmap.close();
      return result;
    });
    expect(decoded.visible).toBe(true);
    const variant = preview.pages[index].variants.find((item) => item.src === decoded.path);
    expect(variant).toBeTruthy();
    expect({ width: decoded.width, height: decoded.height }).toEqual({ width: variant.width, height: variant.height });
  }
  for (const image of preview.pages.flatMap((item) => item.variants)) {
    const bytes = fs.readFileSync(path.join(site, image.src));
    expect(bytes.length).toBe(image.bytes);
    expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(image.sha256);
  }
  await page.locator(".resume-transcript summary").click();
  const transcriptPages = await page.locator("[data-resume-text]").evaluateAll((nodes) => nodes.map((node) => node.textContent));
  // Preserve authored extraction line breaks through production HTML minification.
  expect(transcriptPages).toEqual(preview.pages.map((item) => item.text));
  const transcript = transcriptPages.join(" ");
  const sourceText = require("node:child_process").execFileSync(
    "pdftotext",
    ["-layout", "-enc", "UTF-8", path.join(site, "assets/pdf/en-us/cv.pdf"), "-"],
    { encoding: "utf8" }
  );
  expect(transcript.replace(/\s+/gu, " ").trim()).toBe(sourceText.replace(/\s+/gu, " ").trim());
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await context.close();
});
