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
    expect(Math.abs(indBoxHome!.x - homeBox!.x)).toBeLessThanOrEqual(4);
    expect(Math.abs(indBoxHome!.width - homeBox!.width)).toBeLessThanOrEqual(4);

    // Navigate to Discover
    await desktopNav.locator("a:has-text('Discover')").click();
    await expect(page).toHaveURL(/\/en\/discover/, { timeout: 10000 });
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
    await expect(page).toHaveURL(/\/en\/library/, { timeout: 10000 });
    await page.waitForTimeout(450);
    const libraryLink = desktopNav.locator("a[aria-current='page']");
    const libraryBox = await libraryLink.boundingBox();
    const indBoxLibrary = await indicator.boundingBox();
    expect(Math.abs(indBoxLibrary!.x - libraryBox!.x)).toBeLessThanOrEqual(4);

    // Browser Back to Discover
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/discover/, { timeout: 10000 });
    await page.waitForTimeout(450);
    const indBoxBack = await indicator.boundingBox();
    const discoverBoxAfterBack = await desktopNav.locator("a[aria-current='page']").boundingBox();
    expect(Math.abs(indBoxBack!.x - discoverBoxAfterBack!.x)).toBeLessThanOrEqual(4);

    // Browser Forward to Library
    await page.goForward();
    await expect(page).toHaveURL(/\/en\/library/, { timeout: 10000 });
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

  test("Responsive breakpoint transitions initialize indicator without travel animation", async ({ page }) => {
    // Scenario A: Mobile (390px) -> Desktop (1280px) without reload
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en");

    const mobileNav = page.locator("nav[data-mobile-nav]");
    const desktopNav = page.locator("header nav");
    await expect(mobileNav).toBeVisible();
    await expect(desktopNav).toBeHidden();

    const mobileIndicator = page.locator("[data-testid='mobile-nav-indicator']");
    await expect(mobileIndicator).toBeVisible();

    // Resize to Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(desktopNav).toBeVisible();
    await expect(mobileNav).toBeHidden();

    const desktopIndicator = page.locator("[data-testid='desktop-nav-indicator']");
    await expect(desktopIndicator).toBeVisible();
    await expect(desktopIndicator).toHaveCount(1);

    const homeLink = desktopNav.locator("a[aria-current='page']");
    const homeBox = await homeLink.boundingBox();
    const indBox = await desktopIndicator.boundingBox();
    expect(homeBox).not.toBeNull();
    expect(indBox).not.toBeNull();
    expect(Math.abs(indBox!.x - homeBox!.x)).toBeLessThanOrEqual(4);

    // Verify initial breakpoint activation does not produce a false route-transition animation
    const innerSpan = desktopIndicator.locator("span");
    const stretchClass = await innerSpan.getAttribute("class");
    expect(stretchClass).not.toContain("animate-liquid-stretch");

    await page.screenshot({ path: "screenshots/nav-responsive-mobile-to-desktop.png" });

    // Scenario B: Desktop (1280px) -> Mobile (390px) without reload
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(mobileNav).toBeVisible();
    await expect(desktopNav).toBeHidden();

    await expect(mobileIndicator).toBeVisible();
    await expect(mobileIndicator).toHaveCount(1);

    const mHomeLink = mobileNav.locator("a[aria-current='page']");
    const mHomeBox = await mHomeLink.boundingBox();
    const mIndBox = await mobileIndicator.boundingBox();
    expect(Math.abs(mIndBox!.x - mHomeBox!.x)).toBeLessThanOrEqual(4);

    const mInnerSpan = mobileIndicator.locator("span");
    const mStretchClass = await mInnerSpan.getAttribute("class");
    expect(mStretchClass).not.toContain("animate-liquid-stretch");

    await page.screenshot({ path: "screenshots/nav-responsive-desktop-to-mobile.png" });
  });

  test("Reduced motion emulation disables directional stretch and transition delay", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const desktopNav = page.locator("header nav");
    const indicator = page.locator("[data-testid='desktop-nav-indicator']");
    await expect(indicator).toBeVisible();

    // Verify computed style has zero transition duration under reduced motion
    const transitionDuration = await indicator.evaluate((el) => window.getComputedStyle(el).transitionDuration);
    const durationSec = parseFloat(transitionDuration);
    expect(durationSec <= 0.001 || transitionDuration === "0s" || transitionDuration === "none").toBe(true);

    // Click Discover
    await desktopNav.locator("a:has-text('Discover')").click();
    await expect(page).toHaveURL(/\/en\/discover/);

    // Indicator is NOT permanently hidden: it aligns with Discover
    const discoverLink = desktopNav.locator("a[aria-current='page']");
    await expect(discoverLink).toHaveText("Discover");
    const discoverBox = await discoverLink.boundingBox();
    const indBox = await indicator.boundingBox();
    expect(Math.abs(indBox!.x - discoverBox!.x)).toBeLessThanOrEqual(4);

    // Directional stretch class was never applied
    const innerSpan = indicator.locator("span");
    const classes = await innerSpan.getAttribute("class");
    expect(classes).not.toContain("animate-liquid-stretch");

    await page.screenshot({ path: "screenshots/nav-reduced-motion.png" });
  });

  test("RTL mobile navigation at 390px maintains four columns and smooth capsule alignment", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fa");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const mobileNav = page.locator("nav[data-mobile-nav]");
    await expect(mobileNav).toBeVisible();

    const indicator = page.locator("[data-testid='mobile-nav-indicator']");
    await expect(indicator).toBeVisible();

    // Confirm navigation retains 4 items
    const links = mobileNav.locator("a");
    await expect(links).toHaveCount(4);

    // Measure all four link bounding boxes before navigation
    const initialBoxes = [];
    for (let i = 0; i < 4; i++) {
      const box = await links.nth(i).boundingBox();
      expect(box).not.toBeNull();
      initialBoxes.push(box!);
    }

    // Assert their widths are equal within a small pixel tolerance in the 4-column grid
    const firstWidth = initialBoxes[0].width;
    for (const box of initialBoxes) {
      expect(Math.abs(box.width - firstWidth)).toBeLessThanOrEqual(1.5);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // In RTL, Home ("خانه") is the rightmost item
    const homeLink = mobileNav.locator("a[aria-current='page']");
    await expect(homeLink).toHaveText(/خانه/);

    const homeBox = await homeLink.boundingBox();
    const indBox = await indicator.boundingBox();
    expect(Math.abs(indBox!.x - homeBox!.x)).toBeLessThanOrEqual(4);

    // Navigate to Discover ("کشف") in RTL mobile
    await mobileNav.locator("a[href='/fa/discover']").click();
    await expect(page).toHaveURL(/\/fa\/discover/);
    await page.waitForTimeout(450);

    const discoverLink = mobileNav.locator("a[aria-current='page']");
    await expect(discoverLink).toHaveText(/کشف/);
    const dBox = await discoverLink.boundingBox();
    const dIndBox = await indicator.boundingBox();
    expect(Math.abs(dIndBox!.x - dBox!.x)).toBeLessThanOrEqual(4);

    // Confirm route transition does not shift grid columns or change touch-target heights
    for (let i = 0; i < 4; i++) {
      const afterBox = await links.nth(i).boundingBox();
      expect(afterBox).not.toBeNull();
      expect(Math.abs(afterBox!.x - initialBoxes[i].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(afterBox!.width - initialBoxes[i].width)).toBeLessThanOrEqual(1);
      expect(Math.abs(afterBox!.y - initialBoxes[i].y)).toBeLessThanOrEqual(1);
      expect(Math.abs(afterBox!.height - initialBoxes[i].height)).toBeLessThanOrEqual(1);
      expect(afterBox!.height).toBeGreaterThanOrEqual(44);
    }

    const navBox = await mobileNav.boundingBox();
    expect(navBox?.height).toBeGreaterThanOrEqual(56);

    await page.screenshot({ path: "screenshots/nav-mobile-fa-rtl.png" });
  });

  test("Keyboard navigation, focus outline visibility, and accessibility semantics", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const indicator = page.locator("[data-testid='desktop-nav-indicator']");
    await expect(indicator).toBeVisible();

    // Verify indicator is decorative: aria-hidden="true" and pointer-events: none
    await expect(indicator).toHaveAttribute("aria-hidden", "true");
    const pointerEvents = await indicator.evaluate((el) => window.getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe("none");

    // Tab through to focus navigation links
    await page.keyboard.press("Tab"); // Skip to content
    await page.keyboard.press("Tab"); // Brand home link
    await page.keyboard.press("Tab"); // First nav item (Home)

    const homeLink = page.locator("header nav a[aria-current='page']");
    await expect(homeLink).toBeFocused();

    // Tab to next item (Discover)
    await page.keyboard.press("Tab");
    const discoverLink = page.locator("header nav a:has-text('Discover')");
    await expect(discoverLink).toBeFocused();

    // Assert computed :focus-visible outline style and width are actually visible
    const outlineInfo = await discoverLink.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        zIndex: style.zIndex,
      };
    });
    expect(outlineInfo.outlineStyle).not.toBe("none");
    expect(parseFloat(outlineInfo.outlineWidth)).toBeGreaterThanOrEqual(1);

    // Confirm indicator remains decorative and does not overlap or obscure the link's focus outline
    const indicatorInfo = await indicator.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        pointerEvents: style.pointerEvents,
        zIndex: style.zIndex,
        ariaHidden: el.getAttribute("aria-hidden"),
      };
    });
    expect(indicatorInfo.ariaHidden).toBe("true");
    expect(indicatorInfo.pointerEvents).toBe("none");
    const linkZ = parseInt(outlineInfo.zIndex) || 0;
    const indZ = parseInt(indicatorInfo.zIndex) || 0;
    expect(linkZ).toBeGreaterThan(indZ);

    // Indicator has not received focus
    expect(await indicator.evaluate((el) => document.activeElement === el)).toBe(false);
  });

  test("Layout stability: indicator movement causes zero shift in link geometry", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const desktopNav = page.locator("header nav");
    const links = desktopNav.locator("a");
    const count = await links.count();

    // Record geometry of all navigation links before route change
    const initialBoxes = [];
    for (let i = 0; i < count; i++) {
      initialBoxes.push(await links.nth(i).boundingBox());
    }

    // Navigate to Discover
    await desktopNav.locator("a:has-text('Discover')").click();
    await expect(page).toHaveURL(/\/en\/discover/);
    await page.waitForTimeout(450);

    // Record geometry of all links after route change and indicator movement
    for (let i = 0; i < count; i++) {
      const currentBox = await links.nth(i).boundingBox();
      expect(currentBox).not.toBeNull();
      // Links remain strictly stationary in row layout (y within 1px, x/width within 3px due to font-semibold vs medium)
      expect(Math.abs(currentBox!.y - initialBoxes[i]!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(currentBox!.x - initialBoxes[i]!.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(currentBox!.width - initialBoxes[i]!.width)).toBeLessThanOrEqual(3);
      expect(Math.abs(currentBox!.height - initialBoxes[i]!.height)).toBeLessThanOrEqual(1);
    }
  });

  test("Locale switching preserves logical page and updates active indicator position", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/discover");

    const desktopNav = page.locator("header nav");
    const indicator = page.locator("[data-testid='desktop-nav-indicator']");
    await expect(indicator).toBeVisible();

    const enDiscoverLink = desktopNav.locator("a[aria-current='page']");
    await expect(enDiscoverLink).toHaveText("Discover");

    // Switch to Persian via Appearance Menu
    await page.getByRole("button", { name: "Appearance and language" }).click();
    await page.locator("a:has-text('فارسی')").click();

    // Preserves logical page /discover under /fa
    await expect(page).toHaveURL(/\/fa\/discover/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // In RTL, active item is "کشف" and indicator aligns with it
    const faDiscoverLink = desktopNav.locator("a[aria-current='page']");
    await expect(faDiscoverLink).toHaveText("کشف");

    await page.waitForTimeout(450);
    const faBox = await faDiscoverLink.boundingBox();
    const indBox = await indicator.boundingBox();
    expect(Math.abs(indBox!.x - faBox!.x)).toBeLessThanOrEqual(4);
  });

  test("Observes real in-flight animation with intermediate frame and directional stretch", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en");

    const desktopNav = page.locator("header nav");
    const indicator = page.locator("[data-testid='desktop-nav-indicator']");
    await expect(indicator).toBeVisible();

    const initialBox = await indicator.boundingBox();
    const discoverLink = desktopNav.locator("a:has-text('Discover')");
    const discoverBox = await discoverLink.boundingBox();
    expect(initialBox).not.toBeNull();
    expect(discoverBox).not.toBeNull();

    // Start continuous animation frame tracker in browser before triggering navigation
    await page.evaluate(() => {
      const win = window as unknown as { __animSamples: number[] };
      win.__animSamples = [];
      function record() {
        const ind = document.querySelector("[data-testid='desktop-nav-indicator']");
        if (ind) {
          win.__animSamples.push(ind.getBoundingClientRect().left);
        }
        if (win.__animSamples.length < 25) {
          requestAnimationFrame(record);
        }
      }
      requestAnimationFrame(record);
    });

    // Trigger navigation
    await discoverLink.click();

    // Verify directional stretch animation is immediately applied on the inner capsule
    const innerSpan = indicator.locator("span");
    await expect(innerSpan).toHaveClass(/animate-liquid-stretch-right/);

    // Capture in-flight screenshot during active spring stretch
    await page.screenshot({ path: "screenshots/nav-transition-in-progress.png" });

    // Inspect sampled animation frames recorded across browser animation frames
    const samples: number[] = await page.evaluate(
      () => (window as unknown as { __animSamples?: number[] }).__animSamples ?? [],
    );
    expect(samples.length).toBeGreaterThan(3);

    // Verify indicator traveled continuously: there are frames between start and destination
    const intermediateFrame = samples.find(
      (x) => x > initialBox!.x + 1 && x < discoverBox!.x - 1,
    );
    expect(intermediateFrame).toBeDefined();

    // Allow full settling
    await page.waitForTimeout(400);
    const settledBox = await indicator.boundingBox();
    expect(Math.abs(settledBox!.x - discoverBox!.x)).toBeLessThanOrEqual(4);

    // Directional stretch class has cleared after animation settles
    await expect(innerSpan).not.toHaveClass(/animate-liquid-stretch-right/);
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
