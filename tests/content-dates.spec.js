const { test, expect } = require("@playwright/test");
const base = process.env.PORTFOLIO_URL;
const activity = require("../_data/project_activity.json");
const contentCounts = require("./real-content-counts.cjs");
test.skip(!base, "Set PORTFOLIO_URL to the Docker production preview.");
async function ready(page, suffix = "") {
  await page.goto(base + "/" + suffix, { waitUntil: "networkidle" });
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
}
test("paper and blog cards show full verified dates while month-only sources stay month-only", async ({ page }) => {
  await ready(page, "?view=research");
  const cultural = page.locator(".paper-card").filter({ hasText: "CulturalRiddles" });
  await expect(cultural.locator(".wall-meta time")).toHaveAttribute("datetime", "2026-10-21");
  await expect(cultural.locator(".wall-meta time")).toHaveText("October 21, 2026");
  await expect(cultural.locator(".content-updated")).toContainText("October 27, 2026");
  const include = page.locator(".paper-card").filter({ hasText: "INCLUDE-2.0" });
  await expect(include.locator(".wall-meta time")).toHaveAttribute("datetime", "2026-10");
  await expect(include.locator(".wall-meta time")).toHaveText("October 2026");
  await page.locator("[data-feed-view=blogs]").click();
  await expect(page.locator(".writing-card:visible .wall-meta time")).toHaveCount(contentCounts.writing);
  for (const date of await page.locator(".writing-card:visible .wall-meta time").all()) {
    expect(await date.innerText()).toMatch(/\w+ \d{1,2}, \d{4}/);
  }
});
test("own contribution dates are distinct from upstream activity and creation dates", async ({ page }) => {
  await ready(page, "?view=projects&project=contributions");
  const synthetic = page.locator(".project-card").filter({ hasText: "Synthetic Data Generator" });
  await expect(synthetic.locator(".wall-meta time")).toHaveText("February 20, 2025");
  await synthetic.locator(".project-open").click();
  const body = page.locator("[data-overlay-body]");
  await expect(body.locator(".project-detail")).toBeVisible();
  await body.getByText("Repository dates", { exact: true }).click();
  const resource = activity.projects.collab_synthetic_data_generator.resources[0];
  await expect(body.locator(`.project-resource-dates time[datetime="${resource.created_at}"]`)).toBeVisible();
  await expect(body.locator(`.project-resource-dates time[datetime="${resource.updated_at}"]`)).toBeVisible();
  await body.getByText("Merged contributions", { exact: true }).click();
  await expect(body.locator('.project-source-dates a[href$="/pull/26"]')).toBeVisible();
  await expect(body.locator('a[href$="/pull/26"]')).toHaveCount(1);
  await expect(body.locator(".project-detail-header .post-meta")).toContainText("February 20, 2025");
});
test("latest changes is deterministic, URL-aware and preserves chronological publication sorting", async ({ page }) => {
  await ready(page);
  await page.locator("[data-feed-sort]").selectOption("updated");
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("updated");
  async function order(key) {
    return page.locator("[data-feed-visible=true]").evaluateAll((els, key) => els.map((el) => Number(el.dataset[key])), key);
  }
  const activity = await order("feedActivity");
  expect(activity).toEqual([...activity].sort((a, b) => b - a));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("[data-feed-sort]")).toHaveValue("updated");
  await page.locator("[data-feed-sort]").selectOption("newest");
  await expect(page.locator("[data-profile-feed]")).toHaveAttribute("data-feed-busy", "false");
  const dates = await order("feedDate");
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
});
test("long dates and activity details fit at narrow widths and genuine200percent text", async ({ page }) => {
  test.setTimeout(45000);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await ready(page, "?view=research&sort=updated");
    const sortFits = await page.locator("[data-feed-sort]").evaluate((select) => {
      const style = getComputedStyle(select);
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return context.measureText(select.selectedOptions[0].textContent).width <= available;
    });
    expect(sortFits).toBe(true);
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll("body *")]
        .filter((el) => !el.matches("svg,svg *,script,style"))
        .map((el) => [el, parseFloat(getComputedStyle(el).fontSize)]);
      for (const [el, size] of sizes) if (size) el.style.fontSize = `${size * 2}px`;
    });
    await expect(page.locator("[data-feed-sort]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
});
