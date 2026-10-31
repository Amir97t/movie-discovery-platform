/**
 * E2E tests for live API integration: movie detail page, discover page,
 * internal link navigation, genre filtering, pagination, and image loading.
 */

import { test, expect, type Page } from "@playwright/test";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Helper to mock image optimization requests so general tests do not hang on external network. */
async function mockImageResponses(page: Page) {
  await page.route("**/_next/image*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PNG,
    });
  });
}

test.describe("Movie detail page (live API)", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("renders an existing movie's details from the live API", async ({ page }) => {
    await page.goto("/en/movies/1");

    // Page title should render the movie title from the API
    await expect(page.locator("h1")).toHaveText("The Shawshank Redemption");

    // Detail fields from the API should render
    await expect(page.locator("text=drama")).toBeVisible();
    await expect(page.locator("text=2020")).toBeVisible();
    await expect(page.locator("text=120 min")).toBeVisible();
    // Director appears as both label (dt) and value (dd) - check the value
    await expect(page.locator("dd:has-text('Director')")).toBeVisible();
    await expect(page.locator("text=Actor 1, Actor 2")).toBeVisible();
    await expect(page.locator("text=Plot for The Shawshank Redemption")).toBeVisible();

    // Back to home link present
    await expect(page.locator("a:has-text('← Back to home')")).toBeVisible();
  });

  test("renders a movie beyond page 1 (ID 250) via direct detail endpoint", async ({ page }) => {
    await page.goto("/en/movies/250");

    await expect(page.locator("h1")).toHaveText("Movie 250");
    await expect(page.locator("text=drama")).toBeVisible();
    await expect(page.locator("text=8.0")).toBeVisible();
  });

  test("shows not-found state for a nonexistent movie (HTTP 404)", async ({ page }) => {
    await page.goto("/en/movies/999");

    // Should show the 404 page, not the movie detail
    await expect(page.locator("text=This page is not on the reel")).toBeVisible();
    await expect(page.locator("text=The page you are looking for does not exist or has moved.")).toBeVisible();
    await expect(page.locator("a:has-text('Back to home')")).toBeVisible();
  });

  test("shows error state for network/5xx failures, not a 404 page", async ({ page }) => {
    await page.goto("/en/movies/500");

    // Should show the error state (EmptyState with TriangleAlert), not notFound
    await expect(page.locator("text=Something went wrong")).toBeVisible();
    await expect(page.locator("text=The catalog could not be loaded. Please try again later.")).toBeVisible();
    await expect(page.locator("a:has-text('← Back to home')")).toBeVisible();
  });
});

test.describe("Discover page (live API)", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("renders genre-filtered results from the API with correct genre name", async ({ page }) => {
    await page.goto("/en/discover?genre=scifi&page=1");

    await expect(page.locator("h1")).toHaveText("Discover");
    await expect(page.locator("text=Blade Runner 2049")).toBeVisible();
    await expect(page.locator("text=The Matrix")).toBeVisible();
    // Check for Sci-Fi genre in movie cards (translated via genres namespace)
    await expect(page.locator("article").filter({ hasText: "Sci-Fi" }).first()).toBeVisible();
  });

  test("shows Previous and Next links reflecting pagination metadata", async ({ page }) => {
    await page.goto("/en/discover?genre=scifi&page=2");

    // Sci-Fi has 13 movies, page_size=12, page_count=2
    // Page 2 has 1 movie, hasNext=false, hasPrev=true
    await expect(page.locator("a:has-text('← Previous')")).toBeVisible();
    await expect(page.locator("a:has-text('Next →')")).not.toBeVisible();
    await expect(page.locator("text=Page 2 of 2")).toBeVisible();
  });

  test("preserves genre filter when navigating between pages", async ({ page }) => {
    await page.goto("/en/discover?genre=scifi&page=1");

    const nextLink = page.locator("a:has-text('Next →')");
    await expect(nextLink).toBeVisible();
    await expect(nextLink).toHaveAttribute("href", "/en/discover?genre=scifi&page=2");

    await nextLink.click();

    // After clicking Next, we should be on page 2 with genre=scifi preserved
    await expect(page).toHaveURL(/genre=scifi&page=2/);
    await expect(page.locator("text=Close Encounters of the Third Kind")).toBeVisible();
  });

  test("renders Persian locale correctly on /fa/discover", async ({ page }) => {
    await page.goto("/fa/discover?genre=crime&page=1");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText("کشف");
    await expect(page.locator("text=The Godfather")).toBeVisible();
    await expect(page.locator("text=Pulp Fiction")).toBeVisible();
  });
});

test.describe("Internal localized navigation", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("movie card on Home navigates to detail page under /en", async ({ page }) => {
    await page.goto("/en");
    const firstMovieCard = page.locator("#picks article a").first();
    await expect(firstMovieCard).toBeVisible();
    await firstMovieCard.click();
    await expect(page).toHaveURL(/\/en\/movies\/\d+$/);
    await expect(page.locator("h1")).toBeVisible();
    expect(page.url()).not.toContain("/en/en/");
  });

  test("movie card on Home navigates to detail page under /fa without duplicate locale", async ({ page }) => {
    await page.goto("/fa");
    const firstMovieCard = page.locator("#picks article a").first();
    await expect(firstMovieCard).toBeVisible();
    await firstMovieCard.click();
    await expect(page).toHaveURL(/\/fa\/movies\/\d+$/);
    await expect(page.locator("h1")).toBeVisible();
    expect(page.url()).not.toContain("/fa/fa/");
  });

  test("back to home link on movie details returns to localized home", async ({ page }) => {
    await page.goto("/en/movies/1");
    await page.locator("a:has-text('← Back to home')").first().click();
    await expect(page).toHaveURL(/\/en\/?$/);
    expect(page.url()).not.toContain("/en/en");

    await page.goto("/fa/movies/1");
    await page.locator("a:has-text('← بازگشت به خانه')").first().click();
    await expect(page).toHaveURL(/\/fa\/?$/, { timeout: 10000 });
    expect(page.url()).not.toContain("/fa/fa");
  });

  test("clicking Home genre filters catalog on Home with genre query and page 1", async ({ page }) => {
    await page.goto("/en");
    const scifiChip = page.locator("section[aria-labelledby='catalog-genres-title'] a:has-text('Sci-Fi')").first();
    await scifiChip.click();
    await expect(page).toHaveURL(/\/en\?genre=scifi&page=1/, { timeout: 10000 });
    await expect(page.locator("#picks")).toBeVisible();

    const allChip = page.locator("section[aria-labelledby='catalog-genres-title'] a:has-text('All')").first();
    await allChip.click();
    await expect(page).toHaveURL(/\/en\/?$/, { timeout: 10000 });
  });

  test("clicking Discover genre filters catalog on Discover with genre query and page 1", async ({ page }) => {
    await page.goto("/en/discover?page=1");
    const scifiChip = page.locator("section[aria-labelledby='discover-genres-title'] a:has-text('Sci-Fi')").first();
    await scifiChip.click();
    await expect(page).toHaveURL(/\/en\/discover\?genre=scifi&page=1/);
    await expect(page.locator("h1")).toHaveText("Discover");

    const allChip = page.locator("section[aria-labelledby='discover-genres-title'] a:has-text('All')").first();
    await allChip.click();
    await expect(page).toHaveURL(/\/en\/discover\?page=1/);
  });

  test("desktop navigation links for Library and Profile work in both locales", async ({ page }) => {
    await page.goto("/en");
    await page.locator("header nav a:has-text('Library')").click();
    await expect(page).toHaveURL(/\/en\/library$/);
    await expect(page.locator("h1")).toHaveText("Library");
    await expect(page.locator("text=Library is coming soon")).toBeVisible();

    await page.locator("header nav a:has-text('Profile')").click();
    await expect(page).toHaveURL(/\/en\/profile$/);
    await expect(page.locator("h1")).toHaveText("Profile");
    await expect(page.locator("text=Profile is coming soon")).toBeVisible();

    await page.goto("/fa/library");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText("کتابخانه");

    await page.goto("/fa/profile");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText("پروفایل");
  });
});

test.describe("Genre filtering, chips stability and pagination", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("all genre chips remain stable and visible after filtering and pagination", async ({ page }) => {
    await page.goto("/en/discover?genre=scifi&page=1");
    const genreLinks = page.locator("section[aria-labelledby='discover-genres-title'] ul li a");
    await expect(genreLinks).toHaveCount(21); // "All" + 20 canonical genres

    await page.goto("/en/discover?genre=scifi&page=2");
    await expect(genreLinks).toHaveCount(21);

    await page.goto("/en/discover?page=1");
    await expect(genreLinks).toHaveCount(21);
  });

  test("unfiltered pagination works cleanly without /discover&page syntax", async ({ page }) => {
    await page.goto("/en/discover?page=1");
    const nextLink = page.locator("a:has-text('Next →')");
    await expect(nextLink).toBeVisible();
    await expect(nextLink).toHaveAttribute("href", "/en/discover?page=2");

    await nextLink.click();
    await expect(page).toHaveURL(/\/en\/discover\?page=2/);
    expect(page.url()).not.toContain("&page=2");

    const prevLink = page.locator("a:has-text('← Previous')");
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/en/discover?page=1");
  });

  test("unsupported genre endpoints show graceful localized state, not 404 page", async ({ page }) => {
    await page.goto("/en/discover?genre=unsupported-genre&page=1");
    await expect(page.locator("text=This page is not on the reel")).not.toBeVisible();
    await expect(page.locator("text=Nothing to show yet")).toBeVisible();
    const genreLinks = page.locator("section[aria-labelledby='discover-genres-title'] ul li a");
    await expect(genreLinks).toHaveCount(21);
  });
});

test.describe("Image loading and fallback behavior", () => {
  test.afterEach(async ({ page }) => {
    // Ensure no route interception leaks into subsequent tests
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("successful poster load renders the image and sets data-poster-status='loaded'", async ({ page }) => {
    // 1. Intercept image optimization requests before page navigation
    await page.route("**/_next/image*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: TRANSPARENT_PNG,
      });
    });

    // 2. Navigate to Discover page
    await page.goto("/en/discover?page=1");

    // 3. Verify image load event fires and data-poster-status becomes 'loaded'
    const poster = page.locator("article [data-poster-status='loaded']").first();
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute("data-poster-status", "loaded");
  });

  test("simulated failed poster load renders fallback, sets data-poster-status='error', and retains card dimensions", async ({ page }) => {
    // 1. Intercept image requests before page navigation and abort deliberately
    await page.route("**/_next/image*", async (route) => {
      await route.abort();
    });

    // 2. Navigate to Discover page
    await page.goto("/en/discover?page=1");

    // 3. Verify data-poster-status="error"
    const poster = page.locator("article [data-poster-status='error']").first();
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute("data-poster-status", "error");

    // 4. Verify fallback artwork is displayed instead of blank area
    const fallback = poster.locator("[data-testid='poster-fallback']");
    await expect(fallback).toBeVisible();

    // 5. Verify the card retains its layout and dimensions
    const card = page.locator("article").first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(100);

    // 6. Verify poster retains aspect-[2/3] geometry
    const posterBox = await poster.boundingBox();
    expect(posterBox).not.toBeNull();
    await expect(poster).toHaveClass(/aspect-\[2\/3\]/);
    const ratio = posterBox!.height / posterBox!.width;
    expect(ratio).toBeCloseTo(1.5, 1);
  });
});

test.describe("Phase 2 Catalog, 15-item grid, Hero Carousel and Mobile Drawer", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("Home catalog displays exactly 15 movie cards on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");

    const cards = page.locator("#picks article");
    await expect(cards).toHaveCount(15);
  });

  test("Discover catalog displays 15 cards on page 1, 15 distinct cards on page 2, and 5 cards on final partial page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en/discover?page=1");

    const page1Articles = page.locator("article");
    await expect(page1Articles).toHaveCount(15);

    // Collect all movie IDs from page 1
    const p1Count = await page1Articles.count();
    const p1Ids: string[] = [];
    for (let i = 0; i < p1Count; i++) {
      const href = await page1Articles.nth(i).locator("a[href*='/movies/']").first().getAttribute("href");
      if (href) {
        const match = href.match(/\/movies\/([^/?#]+)/);
        if (match) p1Ids.push(match[1]);
      }
    }
    expect(p1Ids).toHaveLength(15);
    expect(new Set(p1Ids).size).toBe(15);

    // Navigate to page 2
    const nextLink = page.locator("a:has-text('Next →')");
    await expect(nextLink).toBeVisible();
    await nextLink.click();

    await expect(page).toHaveURL(/\/en\/discover\?page=2/);
    const page2Articles = page.locator("article");
    await expect(page2Articles).toHaveCount(15);

    // Collect all movie IDs from page 2
    const p2Count = await page2Articles.count();
    const p2Ids: string[] = [];
    for (let i = 0; i < p2Count; i++) {
      const href = await page2Articles.nth(i).locator("a[href*='/movies/']").first().getAttribute("href");
      if (href) {
        const match = href.match(/\/movies\/([^/?#]+)/);
        if (match) p2Ids.push(match[1]);
      }
    }
    expect(p2Ids).toHaveLength(15);
    expect(new Set(p2Ids).size).toBe(15);

    // Verify ZERO overlap between page 1 and page 2
    for (const id of p2Ids) {
      expect(p1Ids).not.toContain(id);
    }

    // Navigate to page 3 (final partial page, 35 total movies -> 5 items)
    const page2NextLink = page.locator("a:has-text('Next →')");
    await expect(page2NextLink).toBeVisible();
    await page2NextLink.click();

    await expect(page).toHaveURL(/\/en\/discover\?page=3/);
    const page3Articles = page.locator("article");
    await expect(page3Articles).toHaveCount(5);

    const p3Count = await page3Articles.count();
    const p3Ids: string[] = [];
    for (let i = 0; i < p3Count; i++) {
      const href = await page3Articles.nth(i).locator("a[href*='/movies/']").first().getAttribute("href");
      if (href) {
        const match = href.match(/\/movies\/([^/?#]+)/);
        if (match) p3Ids.push(match[1]);
      }
    }
    expect(p3Ids).toHaveLength(5);
    expect(new Set(p3Ids).size).toBe(5);

    // Verify ZERO overlap with page 1 or page 2
    for (const id of p3Ids) {
      expect(p1Ids).not.toContain(id);
      expect(p2Ids).not.toContain(id);
    }
  });

  test("Home preserves genre filter and locale during pagination", async ({ page }) => {
    await page.goto("/fa?genre=crime&page=1");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const nextLink = page.locator("a:has-text('بعدی →')");
    if (await nextLink.isVisible()) {
      await nextLink.click();
      await expect(page).toHaveURL(/\/fa\?genre=crime&page=2/);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }
  });

  test("Hero Carousel Next button changes active movie and synchronizes detail navigation CTA", async ({ page }) => {
    await page.goto("/en");

    const hero = page.locator("section[aria-roledescription='carousel']");
    await expect(hero).toBeVisible();

    const titleLink = hero.locator("h2 a");
    const initialTitle = (await titleLink.innerText()).trim();
    expect(initialTitle).not.toBe("");

    const initialHref = await titleLink.getAttribute("href");
    const initialCtaHref = await hero.locator("a:has-text('View details')").getAttribute("href");
    expect(initialCtaHref).toBe(initialHref);

    // Click Next
    const nextButton = hero.locator("button[aria-label*='Next']");
    await nextButton.click();

    // Active title must actually change to a different movie
    await expect(titleLink).not.toHaveText(initialTitle);

    const newTitle = (await titleLink.innerText()).trim();
    const newHref = await titleLink.getAttribute("href");
    const newCtaHref = await hero.locator("a:has-text('View details')").getAttribute("href");

    expect(newTitle).not.toBe(initialTitle);
    expect(newHref).not.toBe(initialHref);
    expect(newCtaHref).toBe(newHref);

    // Clicking detail CTA navigates to that exact movie ID
    const detailCta = hero.locator("a:has-text('View details')");
    await detailCta.click();
    await expect(page).toHaveURL(new RegExp(newHref + "$"));
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Mobile filter drawer focus trap: initial focus, Tab cycling, Shift+Tab, and Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const filterButton = page.locator("button:has-text('Genres & Filters')").first();
    await expect(filterButton).toBeVisible();
    await filterButton.click();

    const drawer = page.locator("#mobile-genre-drawer");
    await expect(drawer).toBeVisible();

    // 1. Initial focus: close button must be focused
    const closeBtn = drawer.locator("button[aria-label*='Close']");
    await expect(closeBtn).toBeFocused();

    // 2. Tab from final focusable item cycles to first
    const drawerLinks = drawer.locator("a");
    const lastLink = drawerLinks.last();
    await lastLink.focus();
    await expect(lastLink).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();

    // 3. Shift+Tab from first item cycles to final item
    await page.keyboard.press("Shift+Tab");
    await expect(lastLink).toBeFocused();

    // 4. Escape closes drawer and restores focus to trigger button
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(filterButton).toBeFocused();
  });

  test("Mobile filter drawer closes and restores focus when clicking backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const filterButton = page.locator("button:has-text('Genres & Filters')").first();
    await filterButton.click();

    const drawer = page.locator("#mobile-genre-drawer");
    await expect(drawer).toBeVisible();

    // Click outside drawer on backdrop overlay (e.g. at x: 350, y: 100)
    await page.mouse.click(350, 100);
    await expect(drawer).not.toBeVisible();
    await expect(filterButton).toBeFocused();
  });

  test("Mobile filter drawer genre selection navigates and closes drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const filterButton = page.locator("button:has-text('Genres & Filters')").first();
    await filterButton.click();

    const drawer = page.locator("#mobile-genre-drawer");
    await expect(drawer).toBeVisible();

    // Click Sci-Fi link
    const scifiLink = drawer.locator("a:has-text('Sci-Fi')").first();
    await scifiLink.click();

    await expect(drawer).not.toBeVisible();
    await expect(page).toHaveURL(/genre=scifi/);
  });
});

test.describe("Phase 2.3 Discover UX, Documentary Fallback and Atmosphere", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("Documentary genre displays fixture fallback titles and notice on API 404", async ({ page }) => {
    await page.goto("/en/discover?genre=documentary&page=1");

    // Verify fixture fallback notice is visible
    const notice = page.locator("[data-testid='fixture-fallback-notice']");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText("Showing sample titles for this genre.");

    // Verify documentary movie cards are rendered
    const movieCards = page.locator("article h3");
    await expect(movieCards).toHaveCount(2);
    await expect(movieCards.first()).toHaveText("The Quiet Reel");
    await expect(movieCards.nth(1)).toHaveText("The Silent Cartographer");

    // Screenshot of documentary with fixture fallback
    await page.screenshot({
      path: "screenshots/discover-en-documentary-fallback.png",
      fullPage: true,
      animations: "disabled",
    });
  });

  test("Valid genre with successful empty API response (HTTP 200) falls back to matching fixtures", async ({ page }) => {
    await page.goto("/en/discover?genre=animation&page=1");

    // Verify fixture fallback notice is visible
    const notice = page.locator("[data-testid='fixture-fallback-notice']");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText("Showing sample titles for this genre.");

    // Verify animation movie cards from fixtures are rendered
    const movieCards = page.locator("article h3");
    await expect(movieCards).toHaveCount(2);
    await expect(movieCards.first()).toHaveText("Paper Moons Over Harbor City");
    await expect(movieCards.nth(1)).toHaveText("Aurora Drift");
  });

  test("Documentary in Persian displays localized titles and Persian notice", async ({ page }) => {
    await page.goto("/fa/discover?genre=documentary&page=1");

    const notice = page.locator("[data-testid='fixture-fallback-notice']");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText("نمایش نمونه‌های موجود برای این ژانر");

    const movieCards = page.locator("article h3");
    await expect(movieCards).toHaveCount(2);
    await expect(movieCards.first()).toHaveText("حلقه‌ی خاموش");
  });

  test("Captures Discover desktop screenshots across locales and themes", async ({ page }) => {
    test.setTimeout(60000);
    const scenarios = [
      { locale: "en", mode: "dark", width: 1280, height: 900 },
      { locale: "fa", mode: "dark", width: 1280, height: 900 },
      { locale: "en", mode: "light", width: 1280, height: 900 },
      { locale: "fa", mode: "light", width: 1280, height: 900 },
    ];

    for (const s of scenarios) {
      await page.setViewportSize({ width: s.width, height: s.height });
      await page.addInitScript(
        ({ mode }) => {
          localStorage.setItem("frame-appearance", JSON.stringify({ mode }));
          document.documentElement.dataset.mode = mode;
        },
        { mode: s.mode },
      );

      await page.goto(`/${s.locale}/discover?page=1`);
      await page.waitForLoadState("domcontentloaded");

      await page.screenshot({
        path: `screenshots/discover-${s.locale}-${s.mode}-${s.width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });

  test("Captures Discover mobile screenshots across locales and themes", async ({ page }) => {
    test.setTimeout(60000);
    const scenarios = [
      { locale: "en", mode: "dark", width: 390, height: 844 },
      { locale: "fa", mode: "light", width: 390, height: 844 },
    ];

    for (const s of scenarios) {
      await page.setViewportSize({ width: s.width, height: s.height });
      await page.addInitScript(
        ({ mode }) => {
          localStorage.setItem("frame-appearance", JSON.stringify({ mode }));
          document.documentElement.dataset.mode = mode;
        },
        { mode: s.mode },
      );

      await page.goto(`/${s.locale}/discover?page=1`);
      await page.waitForLoadState("domcontentloaded");

      await page.screenshot({
        path: `screenshots/discover-${s.locale}-${s.mode}-${s.width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });
});
