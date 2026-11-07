const { test, expect } = require("@playwright/test");
const fixture = "http://127.0.0.1:8091/tests/content-overlay-fixture.html";
const overlay = "[data-content-overlay-dialog]";
const body = "[data-overlay-body]";
const pageHTML = (name, content = "") =>
  `<!doctype html><html><head><title>${name} | David Quispe</title></head><body><header>Repeated site header</header><main id="main"><article><h1 data-pretext>${name}</h1>${content}</article></main><footer>Repeated site footer</footer><script>window.fetchedScriptExecuted=true</script></body></html>`;
const first = () =>
  pageHTML(
    "First project",
    '<p>Actual project details.</p><a href="/projects/two/" data-content-overlay>Next project</a><a data-lightbox href="/assets/original.svg"><img src="/assets/original.svg" alt="Original project diagram" width="240" height="120"></a><a href="/?view=projects">Back to projects</a>'
  );
async function setup(page) {
  await page.route("**/assets/original.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="gray"/></svg>',
    })
  );
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: first() }));
  await page.route("**/projects/two/", (route) =>
    route.fulfill({ contentType: "text/html", body: pageHTML("Second project", "<p>Another real detail view.</p>") })
  );
  await page.route("**/about/", (route) =>
    route.fulfill({ contentType: "text/html", body: pageHTML("About David", '<a href="/resume/" data-content-overlay>Read CV</a>') })
  );
  await page.route("**/resume/", (route) =>
    route.fulfill({ contentType: "text/html", body: pageHTML("Curriculum vitae", "<p>Verified experience.</p>") })
  );
  await page.route("**/blog/2026/research-note/", (route) =>
    route.fulfill({ contentType: "text/html", body: pageHTML("Research note", "<p>Article content.</p>") })
  );
  await page.route("**/research/real-paper/", (route) =>
    route.fulfill({ contentType: "text/html", body: pageHTML("Real paper", "<p>Publication metadata.</p>") })
  );
  await page.addInitScript(() => {
    window.lifecycle = [];
    document.addEventListener("portfolio:content-mounted", (e) =>
      window.lifecycle.push({
        type: "mounted",
        url: e.detail.url,
        kind: e.detail.kind,
        connected: e.detail.scope.isConnected,
        scroll: e.detail.scrollContainer === e.detail.scope,
      })
    );
    document.addEventListener("portfolio:content-unmounted", (e) =>
      window.lifecycle.push({ type: "unmounted", connected: e.detail.scope.isConnected, children: e.detail.scope.children.length })
    );
  });
  await page.goto(fixture + "?view=projects&sort=newest&q=memory#profile-detail");
}
async function opened(page, title) {
  await expect(page.locator(overlay)).toBeVisible();
  await expect(page.locator(body + " h1")).toHaveText(title);
}

test("content opens at its real URL without replacing profile and closes to exact filters, scroll and focus", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => scrollTo(0, 650));
  const scroll = await page.evaluate(() => scrollY);
  const url = page.url();
  let documents = 0;
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents++;
  });
  await page.locator("#project-one").click();
  await opened(page, "First project");
  await expect(page).toHaveURL(/\/projects\/one\/$/);
  await expect(page).toHaveTitle("First project | David Quispe");
  await expect(page.locator("#profile-query")).toHaveValue("memory");
  await expect(page.locator(body)).not.toContainText("Repeated site header");
  expect(await page.evaluate(() => window.fetchedScriptExecuted)).toBeUndefined();
  await page.locator("[data-overlay-close]").click();
  await expect(page.locator(overlay)).toBeHidden();
  await expect(page).toHaveURL(url);
  await expect(page).toHaveTitle("David Quispe profile");
  await expect(page.locator("#project-one")).toBeFocused();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
  expect(documents).toBe(0);
  const lifecycle = await page.evaluate(() => window.lifecycle);
  expect(lifecycle[0]).toMatchObject({ type: "mounted", kind: "project", connected: true, scroll: true });
  expect(lifecycle.at(-1)).toMatchObject({ type: "unmounted", connected: true, children: 1 });
});

test("Back and Forward traverse cached overlay entries while Close returns to original profile", async ({ page }) => {
  await setup(page);
  const original = page.url();
  let requests = 0;
  page.on("request", (request) => {
    if (/\/projects\/(one|two)\/$/.test(request.url())) requests++;
  });
  await page.locator("#project-one").click();
  await opened(page, "First project");
  await page.locator(body + " a[data-content-overlay]").click();
  await opened(page, "Second project");
  await page.goBack();
  await opened(page, "First project");
  await page.goForward();
  await opened(page, "Second project");
  expect(requests).toBe(2);
  await page.locator("[data-overlay-close]").click();
  await expect(page).toHaveURL(original);
  await expect(page.locator(overlay)).toBeHidden();
  await page.goForward();
  await opened(page, "First project");
});

test("stale requests cannot replace a cached page after browser Back", async ({ page }) => {
  await setup(page);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let began = false;
  await page.route("**/projects/two/", async (route) => {
    began = true;
    await gate;
    try {
      await route.fulfill({ contentType: "text/html", body: pageHTML("Stale second project") });
    } catch {}
  });
  await page.locator("#project-one").click();
  await opened(page, "First project");
  await page.locator(body + " a[data-content-overlay]").click();
  await expect.poll(() => began).toBe(true);
  await expect(page.locator("[data-overlay-status]")).toHaveText("Loading…");
  await page.goBack();
  await opened(page, "First project");
  release();
  await page.waitForTimeout(80);
  await opened(page, "First project");
  await expect(page).toHaveURL(/\/projects\/one\/$/);
});

test("failed fetch offers honest retry and a native full-page link without extra history entries", async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route("**/projects/one/", (route) => route.fulfill({ status: ++attempts === 1 ? 503 : 200, contentType: "text/html", body: first() }));
  const original = page.url();
  await page.locator("#project-one").click();
  await expect(page.locator("[data-overlay-error]")).toBeVisible();
  await expect(page.locator("[data-overlay-error-message]")).toContainText("could not be loaded");
  await expect(page.locator("[data-overlay-open-page]")).toHaveAttribute("href", /\/projects\/one\/$/);
  await page.locator("[data-overlay-retry]").click();
  await opened(page, "First project");
  expect(attempts).toBe(2);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(original);
  await expect(page.locator(overlay)).toBeHidden();
});

test("fetched main is sanitized without executing scripts, styles, event handlers, unsafe URLs or frames", async ({ page }) => {
  await setup(page);
  const payload = pageHTML(
    "Safe project",
    '<script>window.payloadExecuted=true</script><style>body{display:none}</style><img src="/assets/original.svg" onload="window.payloadExecuted=true" style="position:fixed" width="240" height="120" alt="Diagram"><a id="unsafe" href="javascript:window.payloadExecuted=true">Unsafe link</a><svg onload="window.payloadExecuted=true"><animate attributeName="href" to="javascript:alert(1)"></animate></svg><iframe src="https://example.com/embed/" srcdoc="<script>parent.payloadExecuted=true</script>"></iframe><form action="https://example.com/"><input autofocus name="password"></form><a id="relative" href="../two/">Relative project</a>'
  );
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: payload }));
  await page.locator("#project-one").click();
  await opened(page, "Safe project");
  await expect(page.locator(body + " script," + body + " style," + body + " iframe," + body + " form," + body + " animate")).toHaveCount(0);
  expect(
    await page
      .locator(body)
      .evaluate((el) => [...el.querySelectorAll("*")].some((node) => [...node.attributes].some((a) => /^on/i.test(a.name) || a.name === "style")))
  ).toBe(false);
  await expect(page.locator("#unsafe")).not.toHaveAttribute("href");
  await expect(page.locator("#relative")).toHaveAttribute("href", /\/projects\/two\/$/);
  expect(await page.evaluate(() => window.payloadExecuted)).toBeUndefined();
});

test("nested original-image viewer consumes first Escape and content closes only on the second", async ({ page }) => {
  await setup(page);
  const original = page.url();
  await page.locator("#project-one").click();
  await opened(page, "First project");
  await page.locator(body + " a[data-lightbox]").click();
  await expect(page.locator("#image-viewer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#image-viewer")).toBeHidden();
  await expect(page.locator(overlay)).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/one\/$/);
  await page.keyboard.press("Escape");
  await expect(page.locator(overlay)).toBeHidden();
  await expect(page).toHaveURL(original);
});

test("About, CV, writing and paper views retain clean URLs; direct reload renders normal static content", async ({ page }) => {
  await setup(page);
  await page.locator("#about-link").click();
  await opened(page, "About David");
  await expect(page.locator(body)).toHaveAttribute("data-overlay-kind", "about");
  await page.locator(body + " a").click();
  await opened(page, "Curriculum vitae");
  await expect(page.locator(body)).toHaveAttribute("data-overlay-kind", "resume");
  await page.keyboard.press("Escape");
  await expect(page.locator(overlay)).toBeHidden();
  await page.locator("#writing-link").click();
  await opened(page, "Research note");
  await expect(page.locator(body)).toHaveAttribute("data-overlay-kind", "writing");
  await page.keyboard.press("Escape");
  await expect(page.locator(overlay)).toBeHidden();
  await page.locator("#paper-link").click();
  await opened(page, "Real paper");
  await page.reload();
  await expect(page.locator("main h1")).toHaveText("Real paper");
  await expect(page.locator(overlay)).toHaveCount(0);
});

test("backdrop closes, modifier and directory links keep native behavior", async ({ page }) => {
  await setup(page);
  const ignored = await page.evaluate(() => {
    const results = [];
    const handler = (e) => {
      results.push(e.defaultPrevented);
      e.preventDefault();
    };
    document.addEventListener("click", handler);
    document.querySelector("#project-one").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));
    document.querySelector("#directory").click();
    document.querySelector("#external").click();
    document.querySelector("#download").click();
    document.removeEventListener("click", handler);
    return results;
  });
  expect(ignored).toEqual([false, false, false, false]);
  await page.locator("#project-one").click();
  await opened(page, "First project");
  await page.mouse.click(2, 2);
  await expect(page.locator(overlay)).toBeHidden();
});

test("no JavaScript keeps ordinary project navigation usable", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: first() }));
  await page.goto(fixture);
  await page.locator("#project-one").click();
  await expect(page.locator("main h1")).toHaveText("First project");
  await expect(page).toHaveURL(/\/projects\/one\/$/);
  await context.close();
});

test("a normal About host opens CV without profile markup and ignores stale reload history markers", async ({ page }) => {
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const source = readFileSync(join(__dirname, "content-overlay-fixture.html"), "utf8")
    .replace("data-profile-feed", "")
    .replace('<body data-image-zoom="true">', '<body data-image-zoom="true" data-content-overlay-host>')
    .replace("<h1>David Quispe</h1>", "<h1>About David</h1>");
  await page.route("**/tests/content-overlay-fixture.html*", (route) => route.fulfill({ contentType: "text/html", body: source }));
  await page.addInitScript(() =>
    history.replaceState({ __portfolioContentOverlay: { session: "previous-document", url: "/resume/", depth: 1 } }, "", location.href)
  );
  await setup(page);
  await expect(page.locator("[data-profile-feed]")).toHaveCount(0);
  await expect(page.locator(overlay)).toBeHidden();
  expect(await page.evaluate(() => history.state.__portfolioContentOverlay)).toBeUndefined();
  const original = page.url();
  await page.locator("#resume-link").click();
  await opened(page, "Curriculum vitae");
  await page.locator("[data-overlay-close]").click();
  await expect(page).toHaveURL(original);
  await expect(page.locator("#main h1")).toHaveText("About David");
  await expect(page.locator("#resume-link")).toBeFocused();
});

test("only same-origin assets/pdf objects survive with a safe native fallback", async ({ page }) => {
  await setup(page);
  await page.route("**/assets/pdf/en-us/cv.pdf", (route) => route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4\n%%EOF" }));
  const html = pageHTML(
    "Curriculum vitae",
    '<object id="safe-pdf" data="/assets/pdf/en-us/cv.pdf" type="application/pdf" width="100%" height="420" onload="window.pdfUnsafe=true"></object><object id="bad-pdf" data="https://example.com/payload.pdf" type="application/pdf"></object><object id="html-object" data="/assets/pdf/evil.html" type="text/html"></object>'
  );
  await page.route("**/resume/", (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.locator("#resume-link").click();
  await opened(page, "Curriculum vitae");
  await expect(page.locator(body + " object")).toHaveCount(1);
  await expect(page.locator("#safe-pdf")).toHaveAttribute("data", /\/assets\/pdf\/en-us\/cv\.pdf$/);
  await expect(page.locator("#safe-pdf")).not.toHaveAttribute("onload");
  await expect(page.locator("#safe-pdf a")).toHaveAttribute("href", /\/assets\/pdf\/en-us\/cv\.pdf$/);
  expect(await page.evaluate(() => window.pdfUnsafe)).toBeUndefined();
});

test("content hash navigation remains inside the dialog and Close still returns directly to profile", async ({ page }) => {
  await setup(page);
  const original = page.url();
  await page.route("**/projects/one/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: pageHTML(
        "First project",
        '<a href="#details">Read details</a><p style="min-height:1000px">Intro</p><h2 id="details">Details</h2><p>Detailed content.</p>'
      ),
    })
  );
  await page.locator("#project-one").click();
  await opened(page, "First project");
  await page.locator(body + ' a[href$="#details"]').click();
  await expect(page).toHaveURL(/\/projects\/one\/#details$/);
  await expect(page.locator(overlay)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(original);
  await expect(page.locator(overlay)).toBeHidden();
});

test("six-document cache evicts older entries while retaining the most recent content", async ({ page }) => {
  await setup(page);
  const counts = {};
  await page.route("**/projects/cache-*/", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").filter(Boolean).at(-1);
    counts[name] = (counts[name] || 0) + 1;
    return route.fulfill({ contentType: "text/html", body: pageHTML(name) });
  });
  const visit = async (index) => {
    await page.locator("#project-one").evaluate((a, n) => (a.href = `/projects/cache-${n}/`), index);
    await page.locator("#project-one").click();
    await opened(page, `cache-${index}`);
    await page.locator("[data-overlay-close]").click();
    await expect(page.locator(overlay)).toBeHidden();
  };
  for (let n = 0; n < 7; n++) await visit(n);
  await visit(6);
  expect(counts["cache-6"]).toBe(1);
  await visit(0);
  expect(counts["cache-0"]).toBe(2);
});

test("generated optional feature data crosses the reader boundary without importing fetched scripts", async ({ page }) => {
  await setup(page);
  const manifest = { features: ["tabs", "chartjs", "tabs"], libraries: { chartjs: { url: { js: "https://cdn.example.org/pinned-chart.js" } } } };
  const html = pageHTML("Enhanced project", "<p>Readable source remains in the main content.</p>").replace(
    "</body>",
    `<script type="application/json" data-optional-features>${JSON.stringify(manifest)}</script></body>`
  );
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.evaluate(() =>
    document.addEventListener("portfolio:content-mounted", (event) => (window.featurePayload = event.detail.optionalFeatures))
  );
  await page.locator("#project-one").click();
  await opened(page, "Enhanced project");
  expect(await page.evaluate(() => window.featurePayload)).toEqual({ ...manifest, features: ["tabs", "chartjs"] });
  await expect(page.locator(body + " script")).toHaveCount(0);
  expect(await page.evaluate(() => window.fetchedScriptExecuted)).toBeUndefined();
});

test("malformed optional data cannot break a readable reader", async ({ page }) => {
  await setup(page);
  const html = pageHTML("Readable project", "<p>Preserved body.</p>").replace(
    "</body>",
    '<script type="application/json" data-optional-features>{broken</script></body>'
  );
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.evaluate(() =>
    document.addEventListener("portfolio:content-mounted", (event) => (window.featurePayload = event.detail.optionalFeatures))
  );
  await page.locator("#project-one").click();
  await opened(page, "Readable project");
  expect(await page.evaluate(() => window.featurePayload)).toBeNull();
  await expect(page.locator(body + " p")).toHaveText("Preserved body.");
});

test("inert authored math and TikZ remain text without executing fetched script nodes", async ({ page }) => {
  await setup(page);
  const html = pageHTML(
    "Scientific source",
    '<script type="math/tex">x^2+1</script><script type="math/tex; mode=display">y=2</script><script type="text/tikz">\\begin{tikzpicture} authored source \\end{tikzpicture}</script>'
  );
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.locator("#project-one").click();
  await opened(page, "Scientific source");
  await expect(page.locator(body + " script")).toHaveCount(0);
  await expect(page.locator(body + " [data-math-source]")).toHaveText(["\\(x^2+1\\)", "\\[y=2\\]"]);
  await expect(page.locator(body + " pre code.language-tikz")).toHaveText("\\begin{tikzpicture} authored source \\end{tikzpicture}");
  expect(await page.evaluate(() => window.fetchedScriptExecuted)).toBeUndefined();
});

test("only generated exact-provider newsletter email forms survive reader sanitization", async ({ page }) => {
  await setup(page);
  const html = pageHTML(
    "Newsletter source",
    '<form data-newsletter action="https://app.loops.so/api/newsletter-form/fixture-id" method="get" target="_top"><label for="email-source">Email address</label><input id="email-source" type="email" required autocomplete="email" autofocus onfocus="window.unsafeForm=true"><input type="password" name="secret"><button type="submit" formaction="https://example.com/">Subscribe</button><p data-newsletter-status role="status"></p></form><form data-newsletter action="https://app.loops.so.evil.example/api/newsletter-form/fixture"><input type="email"></form>'
  ).replace("</body>", '<script type="application/json" data-optional-features>{"features":["newsletter"]}</script></body>');
  await page.route("**/projects/one/", (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.locator("#project-one").click();
  await opened(page, "Newsletter source");
  await expect(page.locator(body + " form")).toHaveCount(1);
  await expect(page.locator(body + " input")).toHaveCount(1);
  await expect(page.locator(body + " form")).toHaveAttribute("method", "post");
  await expect(page.locator(body + " form")).not.toHaveAttribute("target");
  const email = page.locator(body + " input");
  await expect(email).toHaveAttribute("name", "email");
  await expect(email).toHaveAttribute("required", "");
  await expect(email).not.toHaveAttribute("autofocus");
  await expect(email).not.toHaveAttribute("onfocus");
  const id = await email.getAttribute("id");
  expect(id).toMatch(/^reader-newsletter-/);
  await expect(page.locator(body + " label")).toHaveAttribute("for", id);
  await expect(page.locator(body + " button[type=submit]")).not.toHaveAttribute("formaction");
  expect(await page.evaluate(() => window.unsafeForm)).toBeUndefined();
});
