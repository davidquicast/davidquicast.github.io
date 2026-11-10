const { test, expect } = require("@playwright/test");

async function ready(page) {
  await page.waitForFunction(() => document.querySelectorAll('[data-pretext-ready="true"]').length === 4);
}

test("calculated lines retain real text, links, and browser geometry at narrow and wide widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:8091/");
    await ready(page);
    await expect(page.locator("h1")).toHaveText("Building practical AI systems with accountable agent behavior.");
    await expect(page.locator("h2 a")).toHaveAttribute("href", "#project");
    const measurements = await page.locator("[data-pretext]").evaluateAll((elements) =>
      elements.map((element) => {
        const wrapper = element.querySelector(".pretext-composition");
        const style = getComputedStyle(element);
        const lineHeight = parseFloat(style.lineHeight);
        const predicted = Number(element.dataset.pretextLines);
        // This uses actual DOM line boxes, independent of the library calculation.
        const walker = document.createTreeWalker(wrapper, NodeFilter.SHOW_TEXT);
        const ys = new Set();
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (let offset = 0; offset < node.length; offset++) {
            if (!node.textContent[offset].trim()) continue;
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            for (const rect of range.getClientRects()) ys.add(Math.round(rect.top));
          }
        }
        return {
          predicted,
          actual: ys.size,
          measured: wrapper.getBoundingClientRect().height,
          expected: predicted * lineHeight,
          overflow: wrapper.getBoundingClientRect().right > innerWidth,
        };
      })
    );
    for (const item of measurements) {
      expect(item.actual).toBe(item.predicted);
      expect(Math.abs(item.measured - item.expected)).toBeLessThan(2);
      expect(item.overflow).toBe(false);
    }
  }
});

test("resize reuses prepared text and dynamic content is recomposed", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot());
  await page.setViewportSize({ width: 500, height: 900 });
  await page.waitForFunction((count) => window.portfolioPretext.snapshot().layouts > count, before.layouts);
  const after = await page.evaluate(() => window.portfolioPretext.snapshot());
  // Responsive font size can change hero preparation; fixed-size excerpts are reused.
  expect(after.preparations - before.preparations).toBeLessThan(4);
  expect(after.elements[0].lines).toBeGreaterThanOrEqual(before.elements[0].lines);
  await page.locator("#dynamic").evaluate((element) => {
    element.textContent = "Changed editorial text remains selectable and participates in measured responsive composition.";
  });
  await expect(page.locator("#dynamic .pretext-composition")).toContainText("Changed editorial text");
  await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBeGreaterThan(after.preparations);
});

test("fallback is readable without JavaScript and reduced motion skips the entrance", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await context.newPage();
  await fallback.goto("http://127.0.0.1:8091/");
  await expect(fallback.locator("h1")).toBeVisible();
  await expect(fallback.locator("h2 a")).toHaveAttribute("href", "#project");
  await context.close();
  const reducedContext = await browser.newContext({ reducedMotion: "reduce" });
  const reduced = await reducedContext.newPage();
  await reduced.goto("http://127.0.0.1:8091/");
  await ready(reduced);
  const animations = await reduced
    .locator(".pretext-line")
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).animationName));
  expect(animations.every((name) => name === "none")).toBe(true);
  await reducedContext.close();
});

test("changed text size recomposes the same semantic content", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot());
  await page.locator("[data-pretext]").evaluateAll((elements) =>
    elements.forEach((element) => {
      const computed = getComputedStyle(element);
      const size = parseFloat(computed.fontSize);
      const lineHeight = parseFloat(computed.lineHeight);
      element.style.fontSize = `${size * 2}px`;
      element.style.lineHeight = `${lineHeight * 2}px`;
    })
  );
  await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBeGreaterThan(before.preparations);
  await expect(page.locator("h1")).toHaveText("Building practical AI systems with accountable agent behavior.");
  const count = await page.locator("h1 .pretext-line").count();
  expect(count).toBeGreaterThan(before.elements[0].lines);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("an unbroken title retains native wrapping rather than a clipped manual line", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  const title = "M".repeat(120);
  await page.locator("h1").evaluate((element, content) => {
    element.textContent = content;
  }, title);
  await expect(page.locator("h1")).toHaveText(title);
  await expect.poll(() => page.locator("h1 .pretext-line").count()).toBe(0);
  const geometry = await page.locator("h1").evaluate((element) => ({
    lines: element.querySelector(".pretext-composition").getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight),
    overflow: document.documentElement.scrollWidth - innerWidth,
    visibleWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.lines).toBeGreaterThan(1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.visibleWidth + 1);
});

test("batched ancestor changes preserve inherited typography and avoid unchanged recomposition", async ({ page }) => {
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot());
  await page.locator("main").evaluate((main) => {
    for (let index = 0; index < 100; index++) {
      main.style.transform = `translateY(${index % 2}px)`;
      main.style.opacity = index % 2 ? "1" : ".99";
    }
    main.style.transform = "none";
    main.style.opacity = "1";
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.portfolioPretext.snapshot().layouts)).toBe(before.layouts);
  expect(await page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBe(before.preparations);
  await page.addStyleTag({ content: ".inherited-typography p {font-family:monospace;font-size:23px;line-height:1.8;letter-spacing:.08em}" });
  await page.locator("main").evaluate((main) => {
    main.classList.add("inherited-typography");
    main.style.color = "rgb(30,30,30)";
    main.querySelector("#dynamic").parentElement.style.fontWeight = "400";
  });
  await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBeGreaterThan(before.preparations);
  const geometry = await page.locator("#dynamic").evaluate((element) => ({
    expected: Number(element.dataset.pretextLines) * parseFloat(getComputedStyle(element).lineHeight),
    actual: element.firstElementChild.getBoundingClientRect().height,
    family: getComputedStyle(element).fontFamily,
    text: element.textContent,
  }));
  expect(geometry.family).toBe("monospace");
  expect(Math.abs(geometry.actual - geometry.expected)).toBeLessThan(2);
  expect(geometry.text).toBe("A short excerpt with a readable fallback.");
});

test("hidden ancestor changes compose on reveal and preserve newly inserted semantic links", async ({ page }) => {
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  const before = await page.evaluate(() => window.portfolioPretext.snapshot().preparations);
  await page.locator("#dynamic").evaluate((element) => {
    const section = document.createElement("section");
    section.id = "visibility-scope";
    element.before(section);
    section.append(element);
    section.hidden = true;
    element.textContent = "New content added while hidden remains readable when its section returns.";
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBe(before);
  await page.locator("#visibility-scope").evaluate((section) => {
    section.hidden = false;
  });
  await expect.poll(() => page.evaluate(() => window.portfolioPretext.snapshot().preparations)).toBeGreaterThan(before);
  await expect(page.locator("#dynamic .pretext-composition")).toHaveText("New content added while hidden remains readable when its section returns.");
  await page.locator("#dynamic").evaluate((element) => {
    const link = document.createElement("a");
    link.href = "#project";
    link.textContent = "Semantic project link";
    const emphasis = document.createElement("em");
    emphasis.textContent = " remains selectable.";
    element.replaceChildren(link, emphasis);
  });
  await expect(page.locator("#dynamic")).toHaveAttribute("data-pretext-ready", "native");
  await page.locator("#visibility-scope").evaluate((section) => {
    section.style.fontSize = "25px";
    section.classList.add("new-ancestor-class");
  });
  await expect(page.getByRole("link", { name: "Semantic project link" })).toHaveAttribute("href", "#project");
  await expect(page.locator("#dynamic em")).toHaveText(" remains selectable.");
  expect(
    await page.evaluate(() => window.portfolioPretext.snapshot().elements.some((element) => element.text.includes("Semantic project link")))
  ).toBe(false);
});

async function boundaryFont(page) {
  await page.addStyleTag({
    content:
      '@font-face { font-family: Inter; font-style: normal; font-weight: 500; src: url(/assets/fonts/editorial/inter-latin-500-normal.woff2) format("woff2"); }',
  });
  await page.evaluate(async () => {
    await document.fonts.load("500 15px Inter", "Private Synthetic Data Generation Open Deep Research");
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function boundaryTitle(page, text, width) {
  return page.evaluate(
    ({ text, width }) => {
      const section = document.createElement("section");
      section.id = "boundary-scope";
      section.style.width = `${width}px`;
      const heading = document.createElement("h2");
      Object.assign(heading.style, { font: "500 15px Inter", lineHeight: "21.75px", letterSpacing: "normal", margin: "0" });
      const link = document.createElement("a");
      link.href = "#project";
      link.dataset.pretext = "";
      link.id = "boundary-title";
      link.textContent = text;
      heading.append(link);
      section.append(heading);
      document.querySelector("main").append(section);
      const before = { height: heading.getBoundingClientRect().height, width: heading.getBoundingClientRect().width };
      window.dispatchEvent(new Event("portfolio:content-updated"));
      return before;
    },
    { text, width }
  );
}

test("fractional CSS budgets never round a narrower card up to a clipped model width", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  await boundaryFont(page);
  const text = "Open Deep Research for Vulnerability Intelligence";
  const before = await boundaryTitle(page, text, 176.65625);
  const title = page.locator("#boundary-title");
  await expect(title).toHaveAttribute("data-pretext-ready", "true");
  await expect(title).toHaveAttribute("data-pretext-lines", "3");
  const metrics = await title.evaluate((element) => {
    const wrapper = element.querySelector(".pretext-composition");
    return {
      width: wrapper.getBoundingClientRect().width,
      predictedWidth: Number(element.dataset.pretextWidth),
      height: element.parentElement.getBoundingClientRect().height,
    };
  });
  expect(metrics.width).toBeLessThanOrEqual(before.width);
  expect(metrics.predictedWidth).toBe(metrics.width);
  expect(metrics.height).toBe(before.height);
  const record = await page.evaluate((text) => window.portfolioPretext.snapshot().elements.find((item) => item.text === text), text);
  expect(record.availableWidth).toBe(176.65625);
  await expect(page.getByRole("link", { name: text, exact: true })).toHaveAttribute("href", "#project");
});

test("native fitting fallback preserves hyphenated title height, caches checks and recovers compatible widths", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:8091/");
  await ready(page);
  await boundaryFont(page);
  const text = "Private Synthetic Data Generation Made Easy: Out-of-the-Box with Docker, Argilla & Ollama";
  const before = await boundaryTitle(page, text, 150);
  const title = page.locator("#boundary-title");
  await expect(title).toHaveAttribute("data-pretext-ready", "native");
  await expect(title).toHaveAttribute("data-pretext-fallback", "browser-line-fit");
  expect(await title.getAttribute("data-pretext-lines")).toBeNull();
  expect(await title.getAttribute("data-pretext-width")).toBeNull();
  expect(await title.locator("..").evaluate((heading) => heading.getBoundingClientRect().height)).toBe(before.height);
  const first = await page.evaluate(() => window.portfolioPretext.snapshot());
  const fallback = first.elements.find((item) => item.text === text);
  expect(fallback.lines).toBeUndefined();
  expect(fallback.error).toBeNull();
  expect(fallback.fallbackReason).toBe("browser-line-fit");
  expect(fallback.nativeFit.original).toBe(5);
  await page.locator("#boundary-scope").evaluate((section) => {
    section.style.width = "176.65625px";
  });
  await expect(title).toHaveAttribute("data-pretext-ready", "true");
  const compatible = await page.evaluate(() => window.portfolioPretext.snapshot());
  expect(compatible.preparations).toBe(first.preparations);
  await page.locator("#boundary-scope").evaluate((section) => {
    section.style.width = "150px";
  });
  await expect(title).toHaveAttribute("data-pretext-ready", "native");
  const cached = await page.evaluate(() => window.portfolioPretext.snapshot());
  expect(cached.nativeMeasurements).toBe(compatible.nativeMeasurements);
  expect(cached.nativeFitCacheEntries).toBeLessThanOrEqual(384);
  expect(await title.locator("..").evaluate((heading) => heading.getBoundingClientRect().height)).toBe(before.height);
  await expect(page.getByRole("link", { name: text, exact: true })).toHaveAttribute("href", "#project");
  const selected = await title.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return window.getSelection().toString();
  });
  expect(selected).toBe(text);
});
