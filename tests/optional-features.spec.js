const { test, expect } = require("@playwright/test");
const ORIGIN = "http://127.0.0.1:8091";
const entry = `${ORIGIN}/assets/js/optional-features.js`;
const tabMarkup = `<div data-content-tabs data-name="Fixture tabs">
  <div data-tab-controls><a data-tab-control id="one-tab" href="#one">First</a><a data-tab-control id="two-tab" href="#two">Second</a></div>
  <div data-tab-panel id="one">First panel content</div><div data-tab-panel id="two">Second panel content</div></div>`;
async function mount(page, { features = [], libraries = {}, body = "", labels = {} } = {}) {
  await page.goto(ORIGIN);
  const encode = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Private capability fixture</title></head><body>
    <main>${body}</main><script type="application/json" id="portfolio-ui">${encode(labels)}</script>
    <script type="application/json" data-optional-features>${encode({ features, libraries })}</script>
    <script src="${entry}" defer></script></body></html>`);
}
function library(name) {
  return { url: { js: `${ORIGIN}/fixture-${name}.js` } };
}

test("content tabs support keyboard selection and native no-script anchors", async ({ page, browser }) => {
  await mount(page, { features: ["tabs"], body: tabMarkup });
  await expect(page.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "First" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Second" })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Second" })).toBeVisible();
  await expect(page.locator("#one")).toBeHidden();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "First" })).toBeFocused();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await context.newPage();
  await fallback.setContent(tabMarkup);
  await expect(fallback.locator("#one")).toBeVisible();
  await expect(fallback.locator("#two")).toBeVisible();
  await expect(fallback.getByRole("link", { name: "Second" })).toHaveAttribute("href", "#two");
  await context.close();
});

test("chart renderer deduplicates resources, respects reduced motion and preserves bad source", async ({ page }) => {
  let loads = 0;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(`${ORIGIN}/fixture-chart.js`, async (route) => {
    loads++;
    await route.fulfill({
      contentType: "text/javascript",
      body: "window.chartDefinitions=[]; window.Chart=class { constructor(canvas,options) { window.chartDefinitions.push(options); } };",
    });
  });
  const chart = JSON.stringify({ type: "bar", data: { labels: ["A"], datasets: [{ data: [2] }] }, options: {} });
  await mount(page, {
    features: ["chartjs"],
    libraries: { chartjs: library("chart") },
    body: `<pre><code class="language-chartjs">${chart}</code></pre><div class="language-chartjs highlighter-rouge"><pre><code>${chart}</code></pre></div><pre id="bad"><code class="language-chartjs">invalid JSON</code></pre>`,
  });
  await expect(page.locator('[data-feature="chartjs"][data-feature-state="ready"]')).toHaveCount(2);
  expect(loads).toBe(1);
  expect(await page.evaluate(() => window.chartDefinitions.every((definition) => definition.options.animation === false))).toBe(true);
  await expect(page.locator("#bad")).toBeVisible();
  await expect(page.locator(".feature-error")).toContainText("source remains available");
  await expect(page.locator("details.feature-source")).toHaveCount(2);
});

test("unavailable optional library keeps readable source without a JavaScript exception", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`${ORIGIN}/fixture-down.js`, (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }));
  await mount(page, {
    features: ["chartjs"],
    libraries: { chartjs: library("down") },
    body: '<pre id="source"><code class="language-chartjs">{"type":"bar"}</code></pre>',
  });
  await expect(page.locator(".feature-error")).toBeVisible();
  await expect(page.locator("#source")).toContainText('"type":"bar"');
  expect(errors).toEqual([]);
});

test("resource scheme validation rejects executable URLs and leaves the source available", async ({ page }) => {
  await mount(page, {
    features: ["chartjs"],
    libraries: { chartjs: { url: { js: "javascript:window.injected=true" } } },
    body: '<pre><code class="language-chartjs">{"type":"bar"}</code></pre>',
  });
  await expect(page.locator(".feature-error")).toBeVisible();
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("newsletter validates email, reports rate limits, restores controls and can retry", async ({ page }) => {
  const requests = [];
  await page.route("https://app.loops.so/api/newsletter-form/fixture-test-only", async (route) => {
    requests.push(route.request().postData());
    await route.fulfill({ status: requests.length === 1 ? 429 : 200, contentType: "application/json", body: '{"success":true}' });
  });
  await mount(page, {
    features: ["newsletter"],
    body: `<form data-newsletter action="https://app.loops.so/api/newsletter-form/fixture-test-only" method="post">
    <label for="email">Email address</label><input id="email" name="email" type="email" required><button type="submit">Subscribe</button><p data-newsletter-status role="status"></p></form>`,
  });
  await page.getByLabel("Email address").fill("invalid");
  await page.getByRole("button", { name: "Subscribe" }).click();
  expect(requests.length).toBe(0);
  await page.getByLabel("Email address").fill("fixture@example.invalid");
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByRole("status")).toContainText("Too many requests");
  await expect(page.getByRole("button", { name: "Subscribe" })).toBeEnabled();
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByRole("status")).toHaveText("You are subscribed.");
  expect(requests).toEqual(["email=fixture%40example.invalid&userGroup=", "email=fixture%40example.invalid&userGroup="]);
  await expect(page.getByLabel("Email address")).toHaveValue("");
  await expect(page.locator("form")).not.toHaveAttribute("aria-busy");
});

test("dormant visual flags do not fetch libraries without matching content", async ({ page }) => {
  const loaded = [];
  page.on("request", (request) => {
    if (request.url().includes("fixture-unused")) loaded.push(request.url());
  });
  await mount(page, {
    features: ["chartjs", "map", "slider"],
    libraries: { chartjs: library("unused-chart"), leaflet: library("unused-map"), swiper: library("unused-slider") },
    body: "<p>Plain editorial content.</p>",
  });
  expect(loaded).toEqual([]);
  await expect(page.locator(".feature-render")).toHaveCount(0);
});

test("publication search filters genuine text, restores years and handles no results", async ({ page }) => {
  await mount(page, {
    features: ["research"],
    body: `<div data-research-search-root><label for="papers">Search publications</label><input id="papers" data-research-search disabled><p data-research-status role="status"></p><p data-research-empty hidden>No publications match.</p></div>
    <h2 data-research-year="2026">2026</h2><article data-research-paper data-year="2026">Agent safety by José Quispe</article><h2 data-research-year="2025">2025</h2><article data-research-paper data-year="2025">Security systems by Another Author</article>`,
  });
  await expect(page.getByRole("status")).toHaveText("2 publications");
  await page.getByLabel("Search publications").fill("jose");
  await expect(page.locator("[data-research-paper]:visible")).toHaveCount(1);
  await expect(page.locator('[data-research-year="2025"]')).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("1 publication");
  await page.getByLabel("Search publications").fill("missing topic");
  await expect(page.locator("[data-research-empty]")).toBeVisible();
  await page.getByLabel("Search publications").fill("");
  await expect(page.locator('[data-research-year="2025"]')).toBeVisible();
  await expect(page.locator("[data-research-paper]:visible")).toHaveCount(2);
});

const chartSource =
  '<div class="code-frame"><button type="button" data-fixture-copy>Copy code</button><pre><code class="language-chartjs">{"type":"bar","data":{"datasets":[]}}</code></pre></div>';
async function mountScope(
  page,
  { body = chartSource + tabMarkup, features = ["chartjs", "tabs"], libraries = { chartjs: library("scoped-chart") }, existing = false } = {}
) {
  await page.evaluate(
    ({ body, features, libraries, existing }) => {
      const scope = existing ? document.querySelector("[data-fixture-scope]") : document.createElement("section");
      if (!existing) {
        scope.dataset.fixtureScope = "";
        scope.innerHTML = body;
        document.body.append(scope);
      }
      const detail = { scope, optionalFeatures: { features, libraries }, url: location.origin + "/2026/fixture/", scrollContainer: scope };
      document.dispatchEvent(new CustomEvent("portfolio:content-mounted", { detail }));
      document.dispatchEvent(new CustomEvent("portfolio:content-mounted", { detail }));
    },
    { body, features, libraries, existing }
  );
}
async function unmountScope(page, remove = false) {
  await page.evaluate((remove) => {
    const scope = document.querySelector("[data-fixture-scope]");
    document.dispatchEvent(new CustomEvent("portfolio:content-unmounted", { detail: { scope } }));
    if (remove) scope.remove();
  }, remove);
}

test("runtime without initial manifest mounts only scoped content and disposes twenty chart/tab cycles", async ({ page }) => {
  let loads = 0;
  await page.route(`${ORIGIN}/fixture-scoped-chart.js`, async (route) => {
    loads++;
    await route.fulfill({
      contentType: "text/javascript",
      body: "window.created=0;window.destroyed=0;window.Chart=class{constructor(){window.created++}destroy(){window.destroyed++}}",
    });
  });
  await mount(page, { body: `<div data-background>${chartSource}</div>` });
  await page.locator("[data-optional-features]").evaluate((node) => node.remove());
  for (let index = 0; index < 20; index++) {
    await mountScope(page, { existing: index > 0 });
    const scope = page.locator("[data-fixture-scope]");
    await expect(scope.locator('[data-feature-state="ready"]')).toHaveCount(1);
    await expect(scope.locator("details.feature-source .code-frame [data-fixture-copy]")).toHaveCount(1);
    await scope.getByRole("tab", { name: "First" }).focus();
    await page.keyboard.press("End");
    await expect(scope.getByRole("tab", { name: "Second" })).toBeFocused();
    await unmountScope(page);
    await expect(scope.locator(".feature-render,.feature-source")).toHaveCount(0);
    await expect(scope.getByRole("link", { name: "First" })).toHaveCount(1);
    await expect(scope.locator("[data-tab-panel]:visible")).toHaveCount(2);
  }
  expect(loads).toBe(1);
  expect(await page.evaluate(() => [window.created, window.destroyed])).toEqual([20, 20]);
  await expect(page.locator("[data-background] .feature-render")).toHaveCount(0);
  await expect(page.locator("[data-background] .code-frame")).toHaveCount(1);
});

test("late SDK completion after unmount renders nothing and remains reusable by the next scope", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release;
  let requested;
  const started = new Promise((resolve) => {
    requested = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let loads = 0;
  await page.route(`${ORIGIN}/fixture-delayed.js`, async (route) => {
    loads++;
    requested();
    await gate;
    await route.fulfill({ contentType: "text/javascript", body: "window.created=0;window.Chart=class{constructor(){window.created++}destroy(){}}" });
  });
  await mount(page);
  const options = { features: ["chartjs"], libraries: { chartjs: library("delayed") }, body: chartSource };
  await mountScope(page, options);
  await started;
  await unmountScope(page);
  release();
  await expect.poll(() => page.evaluate(() => typeof window.Chart)).toBe("function");
  expect(await page.evaluate(() => window.created)).toBe(0);
  await expect(page.locator(".feature-render,.feature-error")).toHaveCount(0);
  await mountScope(page, { ...options, existing: true });
  await expect(page.locator('[data-feature-state="ready"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.created)).toBe(1);
  expect(loads).toBe(1);
  expect(errors).toEqual([]);
});

test("scoped map and ECharts dispose renderer instances and resize observers", async ({ page }) => {
  await page.route(`${ORIGIN}/fixture-disposable.js`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.disposed=[];window.observing=0;
    window.ResizeObserver=class{observe(){window.observing++}disconnect(){window.observing--}};
    window.echarts={init:()=>({setOption(){},resize(){},dispose(){window.disposed.push('chart')}})};
    window.L={map:()=>({fitBounds(){},setView(){},invalidateSize(){},remove(){window.disposed.push('map')}}),tileLayer:()=>({addTo(){}}),geoJSON:()=>({addTo(){return{getBounds:()=>({isValid:()=>false})}}})};`,
    })
  );
  await mount(page);
  await mountScope(page, {
    features: ["echarts", "map"],
    libraries: { echarts: { url: { js: { library: `${ORIGIN}/fixture-disposable.js` } } }, leaflet: library("disposable") },
    body: '<pre><code class="language-echarts">{"series":[]}</code></pre><pre><code class="language-geojson">{"type":"FeatureCollection","features":[]}</code></pre>',
  });
  await expect(page.locator('[data-feature-state="ready"]')).toHaveCount(2);
  expect(await page.evaluate(() => window.observing)).toBe(2);
  await unmountScope(page);
  expect(await page.evaluate(() => window.disposed.sort())).toEqual(["chart", "map"]);
  expect(await page.evaluate(() => window.observing)).toBe(0);
});

test("late-loaded dispatcher adopts an already-open overlay without executing unknown features", async ({ page }) => {
  await page.goto(ORIGIN);
  await page.setContent(`<main>Background</main><section data-overlay-body>${tabMarkup}</section>`);
  await page.evaluate(() => {
    document.querySelector("[data-overlay-body]").portfolioOptionalFeatures = {
      features: ["tabs", "execute_script"],
      libraries: { unused: { url: { js: "javascript:window.injected=true" } } },
    };
  });
  await page.addScriptTag({ url: entry });
  await expect(page.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "true");
  await page.addScriptTag({ url: entry });
  await page.getByRole("tab", { name: "Second" }).click();
  await expect(page.getByRole("tabpanel", { name: "Second" })).toBeVisible();
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("native media preview normalizes providers, closes independently and restores its trigger", async ({ page }) => {
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Mock media</title>" }));
  await mount(page);
  await mountScope(page, {
    features: ["media_overlay"],
    libraries: {},
    body: '<a href="https://youtu.be/fixture_123" data-vbtype="video">Watch fixture video</a><a href="javascript:window.injected=true" data-vbtype="iframe">Unsafe fixture</a>',
  });
  const link = page.getByRole("link", { name: "Watch fixture video" });
  await page.getByRole("link", { name: "Unsafe fixture" }).click();
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator(".feature-error")).toHaveCount(1);
  await link.click();
  const dialog = page.getByRole("dialog", { name: "Watch fixture video" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/fixture_123");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(link).toBeFocused();
  await link.click();
  await unmountScope(page);
  await expect(page.locator(".optional-media-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("renderer teardown preserves original code in either controller registration order", async ({ page }) => {
  await page.route(`${ORIGIN}/fixture-integrated.js`, (route) =>
    route.fulfill({ contentType: "text/javascript", body: "window.Chart=class{destroy(){}}" })
  );
  for (const first of ["portfolio", "optional-features"]) {
    await page.goto(ORIGIN);
    const second = first === "portfolio" ? "optional-features" : "portfolio";
    await page.setContent(
      `<main>Host</main><script src="${ORIGIN}/assets/js/${first}.js" defer></script><script src="${ORIGIN}/assets/js/${second}.js" defer></script>`
    );
    await mountScope(page, {
      features: ["chartjs"],
      libraries: { chartjs: library("integrated") },
      body: '<article class="editorial-post"><div class="article-content"><pre id="original-source"><code class="language-chartjs">{"type":"bar"}</code></pre></div></article>',
    });
    await expect(page.locator('[data-fixture-scope] [data-feature-state="ready"]')).toHaveCount(1);
    await expect(page.locator("details.feature-source .copy-code")).toHaveCount(1);
    await unmountScope(page);
    await expect(page.locator("[data-fixture-scope] .feature-render,[data-fixture-scope] .code-frame")).toHaveCount(0);
    await expect(page.locator(".article-content > pre#original-source")).toContainText('"type":"bar"');
  }
});

test("MathJax disables global startup typesetting and clears only the disposed scope", async ({ page }) => {
  await page.route(`${ORIGIN}/fixture-math.js`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.mathStartup=window.MathJax.startup.typeset;window.typed=[];window.cleared=[];window.MathJax={startup:{promise:Promise.resolve()},typesetPromise:(nodes)=>{window.typed.push(nodes[0]);return Promise.resolve()},typesetClear:(nodes)=>{window.cleared.push(nodes[0])}};`,
    })
  );
  await mount(page, { body: "<p data-background>Background mathematics \\(x\\)</p>" });
  await mountScope(page, {
    features: ["math"],
    libraries: { mathjax: library("math") },
    body: '<div class="article-content">Inline mathematics \\(x+y\\)</div>',
  });
  await expect.poll(() => page.evaluate(() => window.typed?.length)).toBe(1);
  expect(await page.evaluate(() => window.mathStartup)).toBe(false);
  expect(await page.evaluate(() => window.typed[0].closest("[data-fixture-scope]") !== null)).toBe(true);
  await unmountScope(page);
  expect(await page.evaluate(() => window.cleared.length)).toBe(1);
  expect(await page.evaluate(() => window.cleared[0] === window.typed[0])).toBe(true);
});
