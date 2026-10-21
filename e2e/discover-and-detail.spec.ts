/**
 * E2E tests for live API integration: movie detail page and discover page.
 *
 * These tests run against a mock API server (tests/mock-api-server.js) started
 * alongside the Next.js dev server via Playwright's webServer config. The
 * NEXT_PUBLIC_MOVIES_API_ORIGIN env var points the Next.js server at the mock
 * instead of https://moviesapi.codingfront.dev, so all server-side fetches hit
 * the mock deterministically.
 */

import { test, expect } from "@playwright/test";

test.describe("Movie detail page (live API)", () => {
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
