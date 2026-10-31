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

test.describe("Phase 3 Liquid Navbar Active Indicator", () => {
  test.beforeEach(async ({ page }) => {
    await mockImageResponses(page);
  });

  test("Desktop active indicator aligns with active item, tracks client-side navigation, and handles Back/Forward", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const desktopNav = page.locator("header nav");
    const indicator = page.locator("[data-testid='desktop-nav-indicator']");

    // Home is initially active
    const homeLink = desktopNav.locator("a[aria-current='page']");
    await expect(homeLink).toHaveText("Home");
    await expect(indicator).toBeVisible();

    const homeBox = await homeLink.boundingBox();
    const indBoxHome = await indicator.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(indBoxHome).not.toBeNull();
    // Indicator aligns closely with active link
    expect(Math.abs(indBoxHome!.x - homeBox!.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(indBoxHome!.width - homeBox!.width)).toBeLessThanOrEqual(4);

    // Navigate to Discover
    await desktopNav.locator("a:has-text('Discover')").click();
    await expect(page).toHaveURL(/\/en\/discover/);
    const discoverLink = desktopNav.locator("a[aria-current='page']");
    await expect(discoverLink).toHaveText("Discover");

    // Allow spring settling
    await page.waitForTimeout(450);
    const discoverBox = await discoverLink.boundingBox();
    const indBoxDiscover = await indicator.boundingBox();
    expect(discoverBox).not.toBeNull();
    expect(indBoxDiscover).not.toBeNull();
    expect(Math.abs(indBoxDiscover!.x - discoverBox!.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(indBoxDiscover!.width - discoverBox!.width)).toBeLessThanOrEqual(4);

    // Navigate to Library
    await desktopNav.locator("a:has-text('Library')").click();
    await expect(page).toHaveURL(/\/en\/library/);
    await page.waitForTimeout(450);
    const libraryLink = desktopNav.locator("a[aria-current='page']");
    const libraryBox = await libraryLink.boundingBox();
    const indBoxLibrary = await indicator.boundingBox();
    expect(Math.abs(indBoxLibrary!.x - libraryBox!.x)).toBeLessThanOrEqual(4);

    // Browser Back to Discover
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/discover/);
    await page.waitForTimeout(450);
    const indBoxBack = await indicator.boundingBox();
    const discoverBoxAfterBack = await desktopNav.locator("a[aria-current='page']").boundingBox();
    expect(Math.abs(indBoxBack!.x - discoverBoxAfterBack!.x)).toBeLessThanOrEqual(4);

    // Browser Forward to Library
    await page.goForward();
    await expect(page).toHaveURL(/\/en\/library/);
    await page.waitForTimeout(450);
    const indBoxForward = await indicator.boundingBox();
    const libraryBoxAfterFwd = await desktopNav.locator("a[aria-current='page']").boundingBox();
    expect(Math.abs(indBoxForward!.x - libraryBoxAfterFwd!.x)).toBeLessThanOrEqual(4);

    // Exactly one desktop indicator
    await expect(page.locator("[data-testid='desktop-nav-indicator']")).toHaveCount(1);
  });

  test("Desktop active indicator respects RTL layout on Persian pages", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/fa");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const desktopNav = page.locator("header nav");
    const indicator = page.locator("[data-testid='desktop-nav-indicator']");

    const homeLink = desktopNav.locator("a[aria-current='page']");
    await expect(homeLink).toHaveText("خانه");
    await expect(indicator).toBeVisible();

    const homeBox = await homeLink.boundingBox();
    const indBox = await indicator.boundingBox();
    expect(Math.abs(indBox!.x - homeBox!.x)).toBeLessThanOrEqual(4);

    // Navigate to Discover ("کشف") in RTL
    await desktopNav.locator("a[href='/fa/discover']").click();
    await expect(page).toHaveURL(/\/fa\/discover/);
    await page.waitForTimeout(450);

    const discoverLink = desktopNav.locator("a[aria-current='page']");
    const discoverBox = await discoverLink.boundingBox();
    const indBoxDiscover = await indicator.boundingBox();
    expect(Math.abs(indBoxDiscover!.x - discoverBox!.x)).toBeLessThanOrEqual(4);
  });

  test("Mobile bottom navigation capsule moves between columns and preserves layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const mobileNav = page.locator("nav[data-mobile-nav]");
    await expect(mobileNav).toBeVisible();

    const indicator = page.locator("[data-testid='mobile-nav-indicator']");
    await expect(indicator).toBeVisible();

    // Home active initially
    const homeLink = mobileNav.locator("a[aria-current='page']");
    await expect(homeLink).toHaveText(/Home/);

    const homeBox = await homeLink.boundingBox();
    const indBoxHome = await indicator.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(indBoxHome).not.toBeNull();
    expect(Math.abs(indBoxHome!.x - homeBox!.x)).toBeLessThanOrEqual(4);

    // Navigate to Discover in mobile bottom bar
    await mobileNav.locator("a:has-text('Discover')").click();
    await expect(page).toHaveURL(/\/en\/discover/);
    await page.waitForTimeout(450);

    const discoverLink = mobileNav.locator("a[aria-current='page']");
    await expect(discoverLink).toHaveText(/Discover/);
    const discoverBox = await discoverLink.boundingBox();
    const indBoxDiscover = await indicator.boundingBox();
    expect(Math.abs(indBoxDiscover!.x - discoverBox!.x)).toBeLessThanOrEqual(4);

    // Bottom nav height is preserved
    const navBox = await mobileNav.boundingBox();
    expect(navBox?.height).toBeGreaterThanOrEqual(56);
  });

  test("Theme-color metadata matches active appearance mode", async ({ page }) => {
    await page.goto("/en");

    // Default dark mode theme-color should be #111318
    const darkMetas = page.locator('meta[name="theme-color"]');
    const darkContent = await darkMetas.first().getAttribute("content");
    expect(darkContent).toBe("#111318");

    // Switch to light mode via appearance menu
    await page.getByRole("button", { name: "Appearance and language" }).click();
    await page.getByRole("button", { name: "Light" }).click();

    // Theme color should now be #F3EFEB
    const lightContent = await page.locator('meta[name="theme-color"]').first().getAttribute("content");
    expect(lightContent).toBe("#F3EFEB");
  });

  test("Captures required visual screenshots for Phase 3 active indicator", async ({ page }) => {
    test.setTimeout(90000);

    // 1. Desktop EN Dark (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "dark" }));
      document.documentElement.dataset.mode = "dark";
    });
    await page.goto("/en");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-desktop-en-dark-1280.png" });

    // 2. Desktop EN Light (1280px)
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "light" }));
      document.documentElement.dataset.mode = "light";
    });
    await page.goto("/en");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-desktop-en-light-1280.png" });

    // 3. Desktop FA Dark RTL (1280px)
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "dark" }));
      document.documentElement.dataset.mode = "dark";
    });
    await page.goto("/fa");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-desktop-fa-dark-1280.png" });

    // 4. Desktop FA Light RTL (1280px)
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "light" }));
      document.documentElement.dataset.mode = "light";
    });
    await page.goto("/fa");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-desktop-fa-light-1280.png" });

    // 5. Mobile EN Dark (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "dark" }));
      document.documentElement.dataset.mode = "dark";
    });
    await page.goto("/en");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-mobile-en-dark-390.png" });

    // 6. Mobile EN Light (390px)
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "light" }));
      document.documentElement.dataset.mode = "light";
    });
    await page.goto("/en");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-mobile-en-light-390.png" });

    // 7. Mobile FA Dark RTL (390px)
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "dark" }));
      document.documentElement.dataset.mode = "dark";
    });
    await page.goto("/fa");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-mobile-fa-dark-390.png" });

    // 8. Mobile FA Light RTL (390px)
    await page.addInitScript(() => {
      localStorage.setItem("frame-appearance", JSON.stringify({ mode: "light" }));
      document.documentElement.dataset.mode = "light";
    });
    await page.goto("/fa");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "screenshots/nav-mobile-fa-light-390.png" });

    // 9. Navigation transition between Home and Discover (Desktop)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/discover");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/nav-transition-home-discover.png" });

    // 10. Navigation transition between Discover and Library (Desktop)
    await page.goto("/en/library");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/nav-transition-discover-library.png" });
  });
});
