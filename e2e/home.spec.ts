import { expect, test } from "@playwright/test";

const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("**/_next/image*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_PNG,
    });
  });
});

const VIEWPORTS: Array<[number, number]> = [
  [360, 800],
  [390, 844],
  [640, 900],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];
const SCREENSHOT_WIDTHS = new Set([390, 768, 1280]);
const THEMES = [
  { mode: "light" },
  { mode: "dark" },
] as const;

for (const locale of ["en", "fa"] as const) {
  for (const [width, height] of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`home ${locale} ${theme.mode} @${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript((value) => localStorage.setItem("frame-appearance", value), JSON.stringify(theme));
        await page.goto(`/${locale}`);

        const html = page.locator("html");
        await expect(html).toHaveAttribute("lang", locale);
        await expect(html).toHaveAttribute("dir", locale === "fa" ? "rtl" : "ltr");
        await expect(html).not.toHaveAttribute("data-palette");
        await expect(html).toHaveAttribute("data-mode", theme.mode);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, "no page-level horizontal overflow").toBeLessThanOrEqual(0);

        if (width < 768) {
          await page.evaluate(async () => {
            document.documentElement.style.scrollBehavior = "auto";
            for (let attempt = 0; attempt < 10; attempt++) {
              window.scrollTo(0, document.body.scrollHeight);
              await new Promise((resolve) => setTimeout(resolve, 100));
              const html = document.documentElement;
              if (window.scrollY >= html.scrollHeight - html.clientHeight - 1) {
                return;
              }
            }
          });
          const footer = await page.locator("footer").boundingBox();
          const nav = await page.locator("nav[data-mobile-nav]").boundingBox();
          expect(footer && nav && footer.y + footer.height <= nav.y + 1, "footer not covered by bottom nav").toBe(true);
          await page.evaluate(() => {
            document.documentElement.style.scrollBehavior = "";
            window.scrollTo(0, 0);
          });
        }

        if (SCREENSHOT_WIDTHS.has(width)) {
          await page.screenshot({
            path: `screenshots/${locale}-${theme.mode}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      });
    }
  }
}

test("mode choice persists across reload and language switch keeps the route", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Appearance and language" }).click();
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
  await expect(page.locator("html")).not.toHaveAttribute("data-palette");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
  await expect(page.locator("html")).not.toHaveAttribute("data-palette");

  await page.getByRole("button", { name: "Appearance and language" }).click();
  await page.getByRole("link", { name: "فارسی" }).click();
  await expect(page).toHaveURL(/\/fa$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "light");
  await expect(page.locator("html")).not.toHaveAttribute("data-palette");
});

test("Escape closes the appearance menu and returns focus to its trigger", async ({ page }) => {
  await page.goto("/en");
  const trigger = page.getByRole("button", { name: "Appearance and language" });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("migrates legacy gold palette in localStorage to canonical mode-only JSON while preserving saved mode", async ({ page }) => {
  // 1. Seed localStorage with legacy 'gold' palette and explicit 'light' mode
  await page.addInitScript(() => {
    localStorage.setItem("frame-appearance", JSON.stringify({ palette: "gold", mode: "light" }));
  });
  await page.goto("/en");

  // 2. Verify rendered theme on <html> has mode light and no data-palette
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-palette");
  await expect(html).toHaveAttribute("data-mode", "light");
  await expect(html).toHaveAttribute("data-mode-pref", "light");

  // 3. Confirm storage is canonicalized to mode-only while preserving mode: 'light'
  const stored = await page.evaluate(() => localStorage.getItem("frame-appearance"));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored!);
  expect(parsed).toEqual({ mode: "light" });
});

test("migrates legacy blue palette with system mode to canonical mode-only JSON and preserves system mode preference", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("frame-appearance", JSON.stringify({ palette: "blue", mode: "system" }));
  });
  await page.goto("/en");

  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-palette");
  await expect(html).toHaveAttribute("data-mode-pref", "system");

  const stored = await page.evaluate(() => localStorage.getItem("frame-appearance"));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored!);
  expect(parsed).toEqual({ mode: "system" });
});

test("handles valid JSON primitives in localStorage safely and canonicalizes to default mode", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("frame-appearance", "42");
  });
  await page.goto("/en");

  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-palette");
  await expect(html).toHaveAttribute("data-mode", "dark");
  await expect(html).toHaveAttribute("data-mode-pref", "dark");

  const stored = await page.evaluate(() => localStorage.getItem("frame-appearance"));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored!);
  expect(parsed).toEqual({ mode: "dark" });
});
