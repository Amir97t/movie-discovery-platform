import { test, expect, type Page } from "@playwright/test";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function mockImageResponses(page: Page) {
  await page.route("**/_next/image*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PNG,
    });
  });
}

test.describe("Phase 4 Search Experience & API Integration", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("Global header search entry point is accessible and navigates to localized search", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const searchLink = page.locator("[data-testid='global-search-link']");
    await expect(searchLink).toBeVisible();
    await expect(searchLink).toHaveAttribute("aria-label", "Search movies");

    // Click search link and verify navigation
    await searchLink.click();
    await expect(page).toHaveURL(/\/en\/search/);
    await expect(page.locator("h1")).toHaveText(/Search/);

    // Verify on Persian locale
    await page.goto("/fa");
    const faSearchLink = page.locator("[data-testid='global-search-link']");
    await expect(faSearchLink).toBeVisible();
    await expect(faSearchLink).toHaveAttribute("aria-label", "جستجوی فیلم‌ها");
    await faSearchLink.click();
    await expect(page).toHaveURL(/\/fa\/search/);
    await expect(page.locator("h1")).toHaveText(/جستجو/);
  });

  test("English search: submit query, verify URL encoding, prefilled input, and URL persistence on reload", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/search");

    const searchInput = page.locator("input[type='search']");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue("");

    // Submit query
    await searchInput.fill("Shawshank");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/en\/search\?q=Shawshank/);

    // Verify results
    const card = page.locator("article:has-text('The Shawshank Redemption')");
    await expect(card).toBeVisible();

    // Verify query remains in the input
    await expect(page.locator("input[type='search']")).toHaveValue("Shawshank");

    // Reload page and confirm URL preserves search query and results
    await page.reload();
    await expect(page).toHaveURL(/\/en\/search\?q=Shawshank/);
    await expect(page.locator("input[type='search']")).toHaveValue("Shawshank");
    await expect(page.locator("article:has-text('The Shawshank Redemption')")).toBeVisible();
  });

  test("Persian search: RTL layout, Persian query, and URL encoding", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/fa/search");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const searchInput = page.locator("input[type='search']");
    await searchInput.fill("ماتریکس");
    await page.locator("form[role='search'] button[type='submit']").click();

    await expect(page).toHaveURL(/\/fa\/search\?q=/);
    await expect(searchInput).toHaveValue("ماتریکس");
  });

  test("Pagination preserves search query, changes page correctly, and new search resets to page 1", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // "Movie" in mock API server matches 33 items (page 1: 15, page 2: 15, page 3: 3)
    await page.goto("/en/search?q=Movie");

    const articles = page.locator("article");
    await expect(articles).toHaveCount(15);

    // Navigate to page 2 via pagination link
    const nextLink = page.locator("nav[aria-label*='agination'] a:has-text('Next')");
    await expect(nextLink).toBeVisible();
    await nextLink.click();

    await expect(page).toHaveURL(/\/en\/search\?q=Movie&page=2/);
    await expect(page.locator("article")).toHaveCount(15);
    await expect(page.locator("input[type='search']")).toHaveValue("Movie");

    // Submitting a new search resets pagination back to page 1
    const searchInput = page.locator("input[type='search']");
    await searchInput.fill("Godfather");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/en\/search\?q=Godfather/);
    expect(page.url()).not.toContain("page=2");
    await expect(page.locator("article:has-text('The Godfather')")).toBeVisible();
  });

  test("Empty query and valid API-empty states", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Empty query shows explore/no-query state
    await page.goto("/en/search");
    await expect(page.locator("h2, h3, [role='status']").filter({ hasText: /Explore the catalog/ })).toBeVisible();

    // Submitting empty input does not make extra request
    const searchInput = page.locator("input[type='search']");
    await searchInput.fill("   ");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/search$/);

    // 2. Valid API query with zero results shows no-results state
    await page.goto("/en/search?q=nonexistent_xyz");
    await expect(page.locator("h2, h3, [role='status']").filter({ hasText: /No movies found/ })).toBeVisible();
    // Does not show fixture fallback badge when API genuinely returned 0 results
    await expect(page.locator("[data-testid='fixture-fallback-notice']")).toHaveCount(0);
  });

  test("Fixture fallback on API failure displays sample results and fallback notice", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Mock server returns 500 for query "lantern" to simulate API failure
    await page.goto("/en/search?q=lantern");

    // Falls back to local fixtures ("The Lantern Archive")
    const fixtureCard = page.locator("article:has-text('The Lantern Archive')");
    await expect(fixtureCard).toBeVisible();

    // Verify fixture fallback notice badge is displayed
    const notice = page.locator("[data-testid='fixture-fallback-notice']");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText(/Live search unavailable\. Showing matching sample titles\./);
  });

  test("Responsive layout: no horizontal overflow at 390px, 768px, and 1280px while preserving 4-item mobile nav", async ({ page }) => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto("/en/search?q=Movie");

      // Verify no horizontal overflow
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(isOverflowing).toBe(false);

      if (vp.width < 768) {
        // Mobile bottom nav retains exactly 4 items
        const mobileNav = page.locator("nav[data-mobile-nav]");
        await expect(mobileNav).toBeVisible();
        const navLinks = mobileNav.locator("a");
        await expect(navLinks).toHaveCount(4);
      }
    }
  });

  test("Accurate search failure and empty fallback state (fail_500) vs valid API-empty state", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Live search fails and local fixtures have no matching titles (fail_500)
    await page.goto("/en/search?q=fail_500");

    // Verify it does NOT display the ordinary API-success empty result message
    await expect(page.locator("h2, h3, [role='status']").filter({ hasText: /^No movies found$/ })).toHaveCount(0);

    // Verify it displays the new live-search-failed / no-local-samples state
    const fallbackTitle = page.locator("h2, h3").filter({ hasText: /Live search unavailable/ });
    await expect(fallbackTitle).toBeVisible();
    await expect(
      page.locator("text=The search service is currently unreachable and no matching sample titles were found in local fixtures."),
    ).toBeVisible();

    // Verify retry button exists and links to retry the query
    const retryButton = page.locator("a:has-text('Try again')");
    await expect(retryButton).toBeVisible();
    await expect(retryButton).toHaveAttribute("href", "/en/search?q=fail_500&page=1");

    // Confirm no result cards or fallback badges appear
    await expect(page.locator("article")).toHaveCount(0);
    await expect(page.locator("[data-testid='fixture-fallback-notice']")).toHaveCount(0);

    // 2. Persian localization assertion for the new state
    await page.goto("/fa/search?q=fail_500");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h2, h3").filter({ hasText: /جستجوی زنده در دسترس نیست/ })).toBeVisible();
    await expect(
      page.locator("text=سرویس جستجوی زنده در حال حاضر در دسترس نیست و عنوان نمونه‌ی منطبقی نیز در داده‌های محلی یافت نشد."),
    ).toBeVisible();
    await expect(page.locator("a:has-text('تلاش مجدد')")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);

    // 3. Contrast with valid API-empty query (nonexistent_xyz)
    await page.goto("/en/search?q=nonexistent_xyz");
    await expect(page.locator("h2, h3").filter({ hasText: /^No movies found$/ })).toBeVisible();
    await expect(page.locator("text=We couldn't find any movies matching \"nonexistent_xyz\".")).toBeVisible();
    await expect(page.locator("h2, h3").filter({ hasText: /Live search unavailable/ })).toHaveCount(0);

    // 4. Contrast with non-empty fixture fallback query (lantern)
    await page.goto("/en/search?q=lantern");
    await expect(page.locator("article:has-text('The Lantern Archive')")).toBeVisible();
    await expect(page.locator("[data-testid='fixture-fallback-notice']")).toBeVisible();
    await expect(page.locator("h2, h3").filter({ hasText: /Live search unavailable/ })).toHaveCount(0);
  });

  test("Captures required visual screenshots for Phase 4 search", async ({ page }) => {
    // 1. EN desktop search results
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/search?q=Shawshank");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-en-desktop.png" });

    // 2. EN mobile search results
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/search?q=Shawshank");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-en-mobile.png" });

    // 3. FA RTL search results
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/fa/search?q=Shawshank");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-fa-rtl.png" });

    // 4. Empty query / no-results state
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/search");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-empty.png" });

    // 5. Fixture fallback state (with matching fixture results)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/search?q=lantern");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-fixture-fallback.png" });

    // 6. EN desktop: failed API + no matching local fixtures (Phase 4.1)
    await page.goto("/en/search?q=fail_500");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-en-fallback-empty.png" });

    // 7. FA RTL: failed API + no matching local fixtures (Phase 4.1)
    await page.goto("/fa/search?q=fail_500");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-fa-fallback-empty.png" });

    // 8. Existing valid API-empty state for comparison (Phase 4.1)
    await page.goto("/en/search?q=nonexistent_xyz");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/search-api-empty.png" });
  });
});
