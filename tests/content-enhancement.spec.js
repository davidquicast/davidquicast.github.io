const { test, expect } = require("@playwright/test");
const ORIGIN = "http://127.0.0.1:8091";
const article = `<article class="editorial-post"><h1 data-pretext="lines">Mounted editorial title</h1>
<aside><details><summary>In this article</summary><nav id="article-toc"></nav></details></aside>
<div class="article-content" id="markdown-content"><h2 id="existing-source">Original identifier</h2>
<p data-reveal>Readable original content.</p><div style="height:500px"></div><h2>Repeated section</h2>
<pre><code>const answer = 42;\n</code></pre><div style="height:400px"></div><h2>Repeated section</h2></div></article>`;
async function mountFixture(page, { progress = false } = {}) {
  await page.addInitScript(() => {
    const observers = [];
    for (const name of ["IntersectionObserver", "ResizeObserver"]) {
      const NativeObserver = window[name];
      window[name] = class extends NativeObserver {
        constructor(...args) {
          super(...args);
          this.targets = new Set();
          observers.push(this);
        }
        observe(target, ...options) {
          this.targets.add(target);
          return super.observe(target, ...options);
        }
        unobserve(target) {
          this.targets.delete(target);
          return super.unobserve(target);
        }
        disconnect() {
          this.targets.clear();
          return super.disconnect();
        }
      };
    }
    // Observe the native cancellation contract without monkey-patching event
    // dispatch/removal itself (that perturbs browser AbortSignal algorithms).
    const controllers = [];
    const NativeAbortController = window.AbortController;
    window.AbortController = class extends NativeAbortController {
      constructor() {
        super();
        if (/\/assets\/js\/(?:portfolio|site-chrome)\.js/.test(new Error().stack || "")) controllers.push(this);
      }
    };
    window.enhancementProbe = () => ({
      activeScopes: controllers.filter((controller) => !controller.signal.aborted).length,
      observations: observers.reduce((count, observer) => count + observer.targets.size, 0),
    });
    window.copyWrites = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copyWrites.push(text);
        },
      },
    });
  });
  const rootArticle = progress
    ? '<article class="editorial-post"><h1>Root article</h1><div class="article-content" style="height:3000px">Original page reading content.</div></article>'
    : "<h1>Underlying profile</h1>";
  await page.route(ORIGIN + "/enhancement-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Private dynamic content fixture</title><style>
body{margin:0;min-height:1600px}#fixture-scope{position:fixed;inset:20px 30px auto;max-height:250px;overflow:auto;background:white;border:1px solid black;padding:12px}.code-frame{position:relative}pre{white-space:pre;overflow:auto}h2{scroll-margin-top:8px}.site-progress{position:fixed;top:0;left:0;right:0;height:2px}.site-progress-fill{display:block;height:100%;transform:scaleX(0);transform-origin:left;background:black}[hidden]{display:none!important}
</style></head><body><main id="main">${rootArticle}</main><script id="portfolio-ui" type="application/json">{"clipboard":{"copy":"Copy code","copied":"Copied","error":"Select and copy the code."}}</script>
<script src="${ORIGIN}/assets/js/portfolio.js" defer></script><script type="module" src="${ORIGIN}/assets/js/dist/editorial.js"></script>
${
  progress
    ? `<div class="site-progress" data-reading-progress hidden aria-hidden="true"><span class="site-progress-fill"></span></div><script src="${ORIGIN}/assets/js/site-chrome.js" data-reading-progress="true" defer></script>`
    : ""
}</body></html>`,
    })
  );
  await page.goto(ORIGIN + "/enhancement-fixture");
  await page.waitForFunction(
    () => window[Symbol.for("portfolio.contentEnhancements")] && window.portfolioPretext && document.fonts.status === "loaded"
  );
}
async function insertArticle(page) {
  await page.evaluate((html) => {
    const scope = document.createElement("div");
    scope.id = "fixture-scope";
    scope.dataset.contentScroll = "";
    scope.innerHTML = html;
    document.body.append(scope);
    document.dispatchEvent(
      new CustomEvent("portfolio:content-mounted", {
        detail: { scope, scrollContainer: scope, kind: "article", url: location.origin + "/blog/fixture/" },
      })
    );
  }, article);
}
async function removeArticle(page) {
  await page.evaluate(() => {
    const scope = document.getElementById("fixture-scope");
    document.dispatchEvent(new CustomEvent("portfolio:content-unmounted", { detail: { scope } }));
    scope.remove();
  });
}

test("twenty dynamic article mounts stay idempotent and release scoped observers and listeners", async ({ page }) => {
  await mountFixture(page);
  // Repeating the entry script must not install another global mount handler.
  await page.addScriptTag({ url: ORIGIN + "/assets/js/portfolio.js" });
  const baseline = await page.evaluate(() => window.enhancementProbe());
  const preparedBaseline = await page.evaluate(() => window.portfolioPretext.snapshot().elements.length);
  for (let cycle = 0; cycle < 20; cycle++) {
    await insertArticle(page);
    const scope = page.locator("#fixture-scope");
    await expect(scope.locator("#article-toc a")).toHaveCount(3);
    await expect(scope.locator(".code-frame")).toHaveCount(1);
    await expect(scope.locator(".copy-code")).toHaveCount(1);
    await expect(scope.locator("h1[data-pretext]")).toHaveAttribute("data-pretext-ready", "true");
    await page.evaluate(() => {
      const scope = document.getElementById("fixture-scope");
      document.dispatchEvent(new CustomEvent("portfolio:content-mounted", { detail: { scope, scrollContainer: scope, kind: "article" } }));
    });
    await expect(scope.locator("#article-toc a")).toHaveCount(3);
    await expect(scope.locator(".copy-code")).toHaveCount(1);
    await scope.locator(".copy-code").click();
    await expect(scope.locator(".copy-code")).toHaveText("Copied");
    expect(await page.evaluate(() => window.copyWrites.length)).toBe(cycle + 1);
    await removeArticle(page);
    await expect.poll(() => page.evaluate(() => window.enhancementProbe())).toEqual(baseline);
    await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().elements.length)).toBe(preparedBaseline);
  }
  expect(await page.evaluate(() => window.copyWrites.every((text) => text === "const answer = 42;\n"))).toBe(true);
});

test("mounted article anchors preserve source IDs and scroll only their own content container", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mountFixture(page);
  await page.evaluate(() => history.replaceState(history.state, "", "#profile"));
  await insertArticle(page);
  const ids = await page.locator("#fixture-scope .article-content h2").evaluateAll((headings) => headings.map((heading) => heading.id));
  expect(ids[0]).toBe("existing-source");
  expect(new Set(ids).size).toBe(3);
  const before = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
  await page.locator("#fixture-scope details").evaluate((details) => {
    details.open = true;
  });
  await page.locator("#fixture-scope #article-toc a").nth(2).click();
  await expect.poll(() => page.locator("#fixture-scope").evaluate((element) => element.scrollTop)).toBeGreaterThan(500);
  expect(await page.evaluate(() => ({ y: scrollY, hash: location.hash }))).toEqual(before);
  await expect(page.locator("#fixture-scope #article-toc a").nth(2)).toHaveAttribute("aria-current", "location");
});

test("unmount cancels pending copy feedback and permits clean enhancement of the same DOM", async ({ page }) => {
  await mountFixture(page);
  await insertArticle(page);
  await page.evaluate(() => {
    navigator.clipboard.writeText = () =>
      new Promise((resolve) => {
        window.finishCopy = resolve;
      });
  });
  const scope = page.locator("#fixture-scope");
  await scope.locator(".copy-code").click();
  await page.evaluate(() => {
    const scope = document.getElementById("fixture-scope");
    window.removedCopyButton = scope.querySelector(".copy-code");
    document.dispatchEvent(new CustomEvent("portfolio:content-unmounted", { detail: { scope } }));
    window.finishCopy();
  });
  await expect(scope.locator(".copy-code, .code-frame, #article-toc a")).toHaveCount(0);
  expect(await page.evaluate(() => window.removedCopyButton.textContent)).toBe("Copy code");
  await page.evaluate(() => {
    const scope = document.getElementById("fixture-scope");
    document.dispatchEvent(new CustomEvent("portfolio:content-mounted", { detail: { scope, scrollContainer: scope } }));
  });
  await expect(scope.locator(".copy-code")).toHaveCount(1);
  await expect(scope.locator("#article-toc a")).toHaveCount(3);
});

test("overlay scrolling never hijacks root reading progress and root unmount stops its chrome", async ({ page }) => {
  await mountFixture(page, { progress: true });
  const progress = page.locator("div[data-reading-progress]");
  await expect(progress).toBeVisible();
  const before = await page.locator(".site-progress-fill").getAttribute("style");
  await insertArticle(page);
  await page.locator("#fixture-scope").evaluate((scope) => {
    scope.scrollTop = 800;
  });
  await removeArticle(page);
  await expect(progress).toBeVisible();
  expect(await page.locator(".site-progress-fill").getAttribute("style")).toBe(before);
  await page.evaluate(() => {
    const scope = document.getElementById("main");
    document.dispatchEvent(new CustomEvent("portfolio:content-unmounted", { detail: { scope } }));
    scope.replaceChildren();
    window.scrollTo(0, 700);
  });
  await expect(progress).toBeHidden();
});
