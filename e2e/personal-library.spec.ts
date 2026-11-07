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

  test("Library mobile responsive layout: 3-column tabs, balanced sort, zero overflow across viewports", async ({
    page,
  }) => {
    const viewports = [
      { width: 360, height: 800, name: "Galaxy S10 (360x800)" },
      { width: 375, height: 812, name: "iPhone SE/Mini (375x812)" },
      { width: 390, height: 844, name: "iPhone 13/14 (390x844)" },
      { width: 412, height: 915, name: "Pixel 7 (412x915)" },
      { width: 768, height: 1024, name: "iPad/Tablet (768x1024)" },
      { width: 1280, height: 800, name: "Desktop (1280x800)" },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Test English LTR
      await page.goto("/en/library", { waitUntil: "domcontentloaded" });

      const container = page.locator("[data-testid='library-container']");
      await expect(container).toBeVisible();

      const tablist = page.locator("div[role='tablist']");
      await expect(tablist).toBeVisible();

      const favTab = page.locator("[data-testid='library-tab-favorites']");
      const watchTab = page.locator("[data-testid='library-tab-watchlist']");
      const watchedTab = page.locator("[data-testid='library-tab-watched']");

      await expect(favTab).toBeVisible();
      await expect(watchTab).toBeVisible();
      await expect(watchedTab).toBeVisible();

      const favBox = await favTab.boundingBox();
      const watchBox = await watchTab.boundingBox();
      const watchedBox = await watchedTab.boundingBox();
      const tablistBox = await tablist.boundingBox();

      expect(favBox).not.toBeNull();
      expect(watchBox).not.toBeNull();
      expect(watchedBox).not.toBeNull();
      expect(tablistBox).not.toBeNull();

      // On mobile viewports (< 640px), tabs occupy 3 equal columns within 4px subpixel tolerance
      if (vp.width < 640) {
        expect(Math.abs(favBox!.width - watchBox!.width)).toBeLessThanOrEqual(4);
        expect(Math.abs(watchBox!.width - watchedBox!.width)).toBeLessThanOrEqual(4);
        // Tabs must have sufficient height for touch targets
        expect(favBox!.height).toBeGreaterThanOrEqual(44);
        expect(watchBox!.height).toBeGreaterThanOrEqual(44);
        expect(watchedBox!.height).toBeGreaterThanOrEqual(44);
      }

      // Check sorting control
      const sortSelect = page.locator("[data-testid='library-sort-select']");
      await expect(sortSelect).toBeVisible();
      const sortBox = await sortSelect.boundingBox();
      expect(sortBox).not.toBeNull();
      expect(sortBox!.x + sortBox!.width).toBeLessThanOrEqual(vp.width);

      // Verify zero horizontal page overflow
      const hasOverflowEn = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflowEn).toBe(false);

      if (vp.width === 360) {
        await page.screenshot({ path: "screenshots/library-mobile-360-en.png" });
      }

      // Test Persian RTL
      await page.goto("/fa/library", { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      const faFavTab = page.locator("[data-testid='library-tab-favorites']");
      const faWatchTab = page.locator("[data-testid='library-tab-watchlist']");
      const faWatchedTab = page.locator("[data-testid='library-tab-watched']");

      await expect(faFavTab).toContainText("علاقه‌مندی‌ها");
      await expect(faWatchTab).toContainText("لیست تماشا");
      await expect(faWatchedTab).toContainText("تماشا شده");

      const faFavBox = await faFavTab.boundingBox();
      const faWatchBox = await faWatchTab.boundingBox();
      const faWatchedBox = await faWatchedTab.boundingBox();

      expect(faFavBox).not.toBeNull();
      expect(faWatchBox).not.toBeNull();
      expect(faWatchedBox).not.toBeNull();

      if (vp.width < 640) {
        expect(Math.abs(faFavBox!.width - faWatchBox!.width)).toBeLessThanOrEqual(4);
        expect(Math.abs(faWatchBox!.width - faWatchedBox!.width)).toBeLessThanOrEqual(4);
        expect(faFavBox!.height).toBeGreaterThanOrEqual(44);
      }

      // Verify zero horizontal overflow in Persian RTL
      const hasOverflowFa = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflowFa).toBe(false);

      if (vp.width === 360) {
        await page.screenshot({ path: "screenshots/library-mobile-360-fa.png" });
      }
    }
  });

  test("Two-tab cross-tab synchronization: updates sync cleanly, filters probe/unrelated keys, and prevents feedback loop", async ({
    page: tab1,
    context,
  }) => {
    await mockImageResponses(tab1);
    const tab2 = await context.newPage();
    await mockImageResponses(tab2);

    // Initial load: tab1 on Home, tab2 on Library
    await tab1.goto("/en", { waitUntil: "domcontentloaded" });
    await tab1.evaluate(() => {
      try {
        window.localStorage.clear();
        window.localStorage.setItem("frame-appearance", JSON.stringify({ mode: "dark" }));
      } catch {}
    });

    await tab2.goto("/en/library", { waitUntil: "domcontentloaded" });
    const tab2FavCount = tab2.locator("[data-testid='tab-count-favorites']");
    await expect(tab2FavCount).toHaveText("0");

    // Start recording storage and custom events on both tabs
    const attachMonitors = async (p: Page) => {
      await p.evaluate(() => {
        const win = window as unknown as {
          __recordedStorageEvents: Array<{ key: string | null; newValue: string | null }>;
          __personalUpdatedDispatches: number;
        };
        win.__recordedStorageEvents = [];
        win.__personalUpdatedDispatches = 0;

        window.addEventListener("storage", (e) => {
          win.__recordedStorageEvents.push({
            key: e.key,
            newValue: e.newValue,
          });
        });

        window.addEventListener("mdp:personal-updated", () => {
          win.__personalUpdatedDispatches++;
        });
      });
    };

    await attachMonitors(tab1);
    await attachMonitors(tab2);

    // 1. Change personal-library state in tab1: Favorite first movie card
    const firstCard = tab1.locator("#picks article").first();
    await expect(firstCard).toBeVisible();
    const favBtn = firstCard.locator("[data-testid='card-favorite-btn']");
    await expect(favBtn).toBeVisible();
    await favBtn.click();
    await expect(favBtn).toHaveAttribute("aria-pressed", "true");

    // 2. Tab2 must reflect the updated state reactively without manual reload
    await expect(tab2FavCount).toHaveText("1");
    const tab2Cards = tab2.locator("[data-testid='library-container'] article");
    await expect(tab2Cards).toHaveCount(1);

    // 3. Tab1 writes unrelated keys and simulated probe keys
    const dispatchesBeforeNoise = await tab2.evaluate(
      () =>
        (window as unknown as { __personalUpdatedDispatches?: number })
          .__personalUpdatedDispatches ?? 0
    );

    const eventsCountBeforeNoise = await tab2.evaluate(
      () =>
        (
          window as unknown as {
            __recordedStorageEvents?: Array<{ key: string | null; newValue: string | null }>;
          }
        ).__recordedStorageEvents?.length ?? 0
    );

    // Write unrelated appearance setting
    await tab1.evaluate(() => {
      window.localStorage.setItem("frame-appearance", JSON.stringify({ mode: "light" }));
    });

    // Write temporary probe key
    await tab1.evaluate(() => {
      window.localStorage.setItem("__mdp_storage_probe__", "1");
      window.localStorage.removeItem("__mdp_storage_probe__");
    });

    // Deterministic bounded poll: wait until tab2 has actually received the noise events from tab1
    await expect
      .poll(
        async () => {
          return await tab2.evaluate((startIndex) => {
            const allEvents =
              (
                window as unknown as {
                  __recordedStorageEvents?: Array<{ key: string | null; newValue: string | null }>;
                }
              ).__recordedStorageEvents ?? [];
            const newEvents = allEvents.slice(startIndex);
            const hasAppearance = newEvents.some(
              (e) => e.key === "frame-appearance" && e.newValue?.includes("light")
            );
            const probeEvents = newEvents.filter((e) => e.key === "__mdp_storage_probe__");
            const hasProbeSet = probeEvents.some((e) => e.newValue !== null);
            const hasProbeRemoved = probeEvents.some((e) => e.newValue === null);
            return hasAppearance && hasProbeSet && hasProbeRemoved;
          }, eventsCountBeforeNoise);
        },
        {
          message: "Wait for Tab 2 to record appearance and probe storage events from Tab 1",
          timeout: 5000,
        }
      )
      .toBe(true);

    // 4. In tab2, personalUpdated dispatches must NOT have increased
    const dispatchesAfterNoise = await tab2.evaluate(
      () =>
        (window as unknown as { __personalUpdatedDispatches?: number })
          .__personalUpdatedDispatches ?? 0
    );
    expect(dispatchesAfterNoise).toBe(dispatchesBeforeNoise);
    await expect(tab2FavCount).toHaveText("1");

    // 5. Verify storage event count is strictly bounded (no runaway feedback loop)
    const tab2Events = await tab2.evaluate(
      () =>
        (
          window as unknown as {
            __recordedStorageEvents?: Array<{ key: string | null }>;
          }
        ).__recordedStorageEvents ?? []
    );
    const personalKeyEvents = tab2Events.filter((e) => e.key === "mdp_personal_v1");
    expect(personalKeyEvents.length).toBe(1);

    // In tab1, verify tab2 never echoed any feedback probe events
    const tab1Events = await tab1.evaluate(
      () =>
        (
          window as unknown as {
            __recordedStorageEvents?: Array<{ key: string | null }>;
          }
        ).__recordedStorageEvents ?? []
    );
    const tab1PersonalEchoEvents = tab1Events.filter(
      (e) => e.key === "mdp_personal_v1"
    );
    expect(tab1PersonalEchoEvents.length).toBe(0);

    // 6. Verify unrelated appearance preferences remained preserved in localStorage
    const storedAppearance = await tab2.evaluate(() =>
      window.localStorage.getItem("frame-appearance")
    );
    expect(storedAppearance).toBeTruthy();
    expect(storedAppearance).toContain("light");

    await tab2.close();
  });
});
