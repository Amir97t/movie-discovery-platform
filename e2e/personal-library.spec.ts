import { expect, test, type Page } from "@playwright/test";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
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

test.describe("Personal Library Foundation (Favorites, Watchlist, Watched)", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
      } catch {}
    });
  });

  test("Card personal actions on Home toggle states without triggering card navigation", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });

    const firstCard = page.locator("#picks article").first();
    await expect(firstCard).toBeVisible();

    const favBtn = firstCard.locator("[data-testid='card-favorite-btn']");
    const watchlistBtn = firstCard.locator("[data-testid='card-watchlist-btn']");
    const watchedBtn = firstCard.locator("[data-testid='card-watched-btn']");

    await expect(favBtn).toBeVisible();
    await expect(favBtn).toHaveAttribute("aria-pressed", "false");

    // Click favorite button - URL must NOT change to detail page
    await favBtn.click();
    await expect(favBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/\/en\/?$/);

    // Click watchlist button
    await watchlistBtn.click();
    await expect(watchlistBtn).toHaveAttribute("aria-pressed", "true");

    // Click watched button - must clear watchlist
    await watchedBtn.click();
    await expect(watchedBtn).toHaveAttribute("aria-pressed", "true");
    await expect(watchlistBtn).toHaveAttribute("aria-pressed", "false");

    // Verify localStorage has persisted data
    const storageData = await page.evaluate(() =>
      window.localStorage.getItem("mdp_personal_v1")
    );
    expect(storageData).toBeTruthy();
    expect(storageData).toContain('"isFavorite":true');
    expect(storageData).toContain('"listStatus":"watched"');
  });

  test("Movie detail page actions persist across browser reload", async ({ page }) => {
    await page.goto("/en/movies/quiet-reel", { waitUntil: "domcontentloaded" });

    const actionsBar = page.locator("[data-testid='detail-personal-actions']");
    await expect(actionsBar).toBeVisible();

    const favBtn = actionsBar.locator("[data-testid='detail-favorite-btn']");
    const watchlistBtn = actionsBar.locator("[data-testid='detail-watchlist-btn']");
    const watchedBtn = actionsBar.locator("[data-testid='detail-watched-btn']");

    await expect(favBtn).toHaveText("Favorite");
    await expect(favBtn).toHaveAttribute("aria-pressed", "false");
    await expect(watchedBtn).toHaveText("Watched");
    await expect(watchedBtn).toHaveAttribute("aria-pressed", "false");

    // Click Favorite
    await favBtn.click();
    await expect(favBtn).toHaveAttribute("aria-pressed", "true");
    await expect(favBtn).toHaveText("In Favorites");

    // Click Watchlist
    await watchlistBtn.click();
    await expect(watchlistBtn).toHaveAttribute("aria-pressed", "true");
    await expect(watchlistBtn).toHaveText("In Watchlist");

    // Reload page to verify persistence
    await page.reload({ waitUntil: "domcontentloaded" });

    const favBtnAfter = page.locator("[data-testid='detail-favorite-btn']");
    const watchlistBtnAfter = page.locator("[data-testid='detail-watchlist-btn']");

    await expect(favBtnAfter).toHaveAttribute("aria-pressed", "true");
    await expect(favBtnAfter).toHaveText("In Favorites");
    await expect(watchlistBtnAfter).toHaveAttribute("aria-pressed", "true");
    await expect(watchlistBtnAfter).toHaveText("In Watchlist");
  });

  test("Card action state synchronizes with movie detail page", async ({ page }) => {
    await page.goto("/en/discover?genre=documentary&page=1", { waitUntil: "domcontentloaded" });

    const quietReelCard = page.locator("article", {
      has: page.locator("h3:has-text('The Quiet Reel')"),
    });
    await expect(quietReelCard).toBeVisible();

    // Favorite on card
    const cardFavBtn = quietReelCard.locator("[data-testid='card-favorite-btn']");
    await cardFavBtn.click();
    await expect(cardFavBtn).toHaveAttribute("aria-pressed", "true");

    // Navigate to detail page by clicking the link
    const link = quietReelCard.locator("a[href*='quiet-reel']").first();
    await link.click();
    await expect(page).toHaveURL(/\/en\/movies\/quiet-reel/);

    // Detail page should immediately show In Favorites
    const detailFavBtn = page.locator("[data-testid='detail-favorite-btn']");
    await expect(detailFavBtn).toBeVisible();
    await expect(detailFavBtn).toHaveAttribute("aria-pressed", "true");
    await expect(detailFavBtn).toHaveText("In Favorites");
  });

  test("Detail page actions in Persian show localized labels and respect RTL", async ({ page }) => {
    await page.goto("/fa/movies/quiet-reel", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const favBtn = page.locator("[data-testid='detail-favorite-btn']");
    const watchlistBtn = page.locator("[data-testid='detail-watchlist-btn']");
    const watchedBtn = page.locator("[data-testid='detail-watched-btn']");

    await expect(favBtn).toHaveText("علاقه‌مندی");
    await expect(watchlistBtn).toHaveText("لیست تماشا");
    await expect(watchedBtn).toHaveText("تماشا شده");

    // Toggle Favorite in Persian
    await favBtn.click();
    await expect(favBtn).toHaveText("در علاقه‌مندی‌ها");
    await expect(favBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("Personal movie rating can be set, fine-tuned, cleared, and persists across reload", async ({ page }) => {
    await page.goto("/en/movies/quiet-reel", { waitUntil: "domcontentloaded" });

    const ratingSection = page.locator("[data-testid='personal-rating-section']");
    await expect(ratingSection).toBeVisible();

    // Initially not rated
    await expect(ratingSection).toContainText("Not rated yet");

    // Click star 8
    const star8 = page.locator("[data-testid='star-rating-btn-8']");
    await star8.click();
    await expect(ratingSection).toContainText("You rated 8.0 / 10");

    // Clear rating
    const clearBtn = page.locator("[data-testid='clear-rating-btn']");
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(ratingSection).toContainText("Not rated yet");

    // Set rating to 9 via star button
    const star9 = page.locator("[data-testid='star-rating-btn-9']");
    await star9.click();
    await expect(ratingSection).toContainText("You rated 9.0 / 10");

    // Reload and check persistence
    await page.reload({ waitUntil: "domcontentloaded" });
    const ratingSectionAfter = page.locator("[data-testid='personal-rating-section']");
    await expect(ratingSectionAfter).toContainText("You rated 9.0 / 10");
  });

  test("Local comments can be added, displayed as safe text, deleted, and persist across reload", async ({ page }) => {
    await page.goto("/en/movies/quiet-reel", { waitUntil: "domcontentloaded" });

    const commentsSection = page.locator("[data-testid='local-comments-section']");
    await expect(commentsSection).toBeVisible();

    const countBadge = commentsSection.locator("[data-testid='comments-count-badge']");
    await expect(countBadge).toHaveText("0");
    await expect(commentsSection.locator("[data-testid='comments-empty-state']")).toBeVisible();

    // Type and submit note
    const input = commentsSection.locator("[data-testid='comment-input']");
    const submitBtn = commentsSection.locator("[data-testid='submit-comment-btn']");

    await input.fill("A brilliant cinematic meditation on silence.");
    await submitBtn.click();

    // Verify comment is displayed and count updated
    await expect(countBadge).toHaveText("1");
    await expect(commentsSection.locator("[data-testid='comments-empty-state']")).not.toBeVisible();
    await expect(commentsSection).toContainText("A brilliant cinematic meditation on silence.");

    // Reload page to verify persistence
    await page.reload({ waitUntil: "domcontentloaded" });

    const commentsSectionAfter = page.locator("[data-testid='local-comments-section']");
    await expect(commentsSectionAfter.locator("[data-testid='comments-count-badge']")).toHaveText("1");
    await expect(commentsSectionAfter).toContainText("A brilliant cinematic meditation on silence.");

    // Delete comment
    const deleteBtn = commentsSectionAfter.locator("[data-testid^='delete-comment-btn-']").first();
    await deleteBtn.click();

    await expect(commentsSectionAfter.locator("[data-testid='comments-count-badge']")).toHaveText("0");
    await expect(commentsSectionAfter.locator("[data-testid='comments-empty-state']")).toBeVisible();
  });

  test("Ratings and local comments in Persian show localized UI and RTL layout", async ({ page }) => {
    await page.goto("/fa/movies/quiet-reel", { waitUntil: "domcontentloaded" });

    const ratingSection = page.locator("[data-testid='personal-rating-section']");
    await expect(ratingSection).toBeVisible();
    await expect(ratingSection).toContainText("هنوز امتیازی ثبت نشده");

    // Click star 7
    await page.locator("[data-testid='star-rating-btn-7']").click();
    await expect(ratingSection).toContainText("امتیاز شما: 7.0 از ۱۰");

    // Comments section
    const commentsSection = page.locator("[data-testid='local-comments-section']");
    await expect(commentsSection).toBeVisible();

    const input = commentsSection.locator("[data-testid='comment-input']");
    const submitBtn = commentsSection.locator("[data-testid='submit-comment-btn']");

    await input.fill("یک فیلم فوق‌العاده با تصویربرداری عالی.");
    await submitBtn.click();

    await expect(commentsSection).toContainText("یک فیلم فوق‌العاده با تصویربرداری عالی.");
  });

  test("Library page displays saved collections across tabs with empty states", async ({ page }) => {
    // Save quiet-reel to Favorites
    await page.goto("/en/movies/quiet-reel", { waitUntil: "domcontentloaded" });
    const favBtn = page.locator("[data-testid='detail-favorite-btn']");
    await favBtn.click();
    await expect(favBtn).toHaveAttribute("aria-pressed", "true");

    // Navigate to Library
    await page.goto("/en/library", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/en\/library/);

    const container = page.locator("[data-testid='library-container']");
    await expect(container).toBeVisible();

    // Favorites tab has count 1 and shows quiet-reel
    await expect(page.locator("[data-testid='tab-count-favorites']")).toHaveText("1");
    await expect(page.locator("article", { hasText: "The Quiet Reel" })).toBeVisible();

    // Watchlist tab is empty
    await page.locator("[data-testid='library-tab-watchlist']").click();
    await expect(page.locator("[data-testid='tab-count-watchlist']")).toHaveText("0");
    await expect(page.locator("[data-testid='empty-discover-link']")).toBeVisible();
    await expect(page.locator("[data-testid='empty-search-link']")).toBeVisible();
  });

  test("Profile page displays derived statistics, supports profile editing, and safe data reset", async ({ page }) => {
    // Save quiet-reel to Favorites and rate it 9
    await page.goto("/en/movies/quiet-reel", { waitUntil: "domcontentloaded" });
    await page.locator("[data-testid='detail-favorite-btn']").click();
    await page.locator("[data-testid='star-rating-btn-9']").click();

    // Navigate to Profile via desktop nav
    await page.locator("header nav.md\\:block a:has-text('Profile')").click();
    await expect(page).toHaveURL(/\/en\/profile/);

    // Verify statistics
    await expect(page.locator("[data-testid='stat-count-favorites']")).toHaveText("1");
    await expect(page.locator("[data-testid='stat-count-rated']")).toHaveText("1");
    await expect(page.locator("[data-testid='stat-value-avg-rating']")).toHaveText("9.0");

    // Edit Profile
    await page.locator("[data-testid='edit-profile-btn']").click();
    await page.locator("[data-testid='display-name-input']").fill("Lead Curator");
    await page.locator("[data-testid='bio-input']").fill("Exploring experimental cinema.");
    await page.locator("[data-testid='save-profile-btn']").click();

    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Lead Curator");

    // Reload page to confirm persistence
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-testid='profile-display-name']")).toHaveText("Lead Curator");

    // Reset Data Flow
    await page.locator("[data-testid='reset-data-btn']").click();
    const modal = page.locator("[data-testid='reset-confirmation-modal']");
    await expect(modal).toBeVisible();

    const confirmBtn = page.locator("[data-testid='confirm-reset-btn']");
    await expect(confirmBtn).toBeDisabled();

    await page.locator("[data-testid='reset-confirm-input']").fill("RESET");
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(modal).not.toBeVisible();
    await expect(page.locator("[data-testid='stat-count-favorites']")).toHaveText("0");
    await expect(page.locator("[data-testid='stat-count-rated']")).toHaveText("0");
  });

  test("Library and Profile pages in Persian show localized tabs and RTL layout", async ({ page }) => {
    await page.goto("/fa/library", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("h1")).toHaveText("کتابخانه");
    await expect(page.locator("[data-testid='library-tab-favorites']")).toContainText("علاقه‌مندی‌ها");
    await expect(page.locator("[data-testid='library-tab-watchlist']")).toContainText("لیست تماشا");
    await expect(page.locator("[data-testid='library-tab-watched']")).toContainText("تماشا شده");

    await page.goto("/fa/profile", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toHaveText("پروفایل");
    await expect(page.locator("[data-testid='edit-profile-btn']")).toContainText("ویرایش پروفایل");
    await expect(page.locator("[data-testid='export-backup-btn']")).toContainText("خروجی پشتیبان (JSON)");
  });
});
