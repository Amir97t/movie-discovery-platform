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
    await expect(page.locator("text=Sci-Fi").first()).toBeVisible();
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
    await expect(page).toHaveURL(/\/fa\/?$/);
    expect(page.url()).not.toContain("/fa/fa");
  });

  test("clicking Home genre opens Discover with genre query and page 1", async ({ page }) => {
    await page.goto("/en");
    const scifiChip = page.locator("a:has-text('Sci-Fi')").first();
    await scifiChip.click();
    await expect(page).toHaveURL(/\/en\/discover\?genre=scifi&page=1/);
    await expect(page.locator("h1")).toHaveText("Discover");

    await page.goto("/en");
    const allChip = page.locator("a:has-text('All')").first();
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
