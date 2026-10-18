import { expect, test } from "@playwright/test";

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
  { palette: "gold", mode: "light" },
  { palette: "gold", mode: "dark" },
  { palette: "crimson", mode: "light" },
  { palette: "crimson", mode: "dark" },
] as const;

for (const locale of ["en", "fa"] as const) {
  for (const [width, height] of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`home ${locale} ${theme.palette}-${theme.mode} @${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript((value) => localStorage.setItem("frame-appearance", value), JSON.stringify(theme));
        await page.goto(`/${locale}`);

        const html = page.locator("html");
        await expect(html).toHaveAttribute("lang", locale);
        await expect(html).toHaveAttribute("dir", locale === "fa" ? "rtl" : "ltr");
        await expect(html).toHaveAttribute("data-palette", theme.palette);
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
            path: `screenshots/${locale}-${theme.palette}-${theme.mode}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      });
    }
  }
}

test("palette choice persists across reload and language switch keeps the route", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Appearance and language" }).click();
  await page.getByRole("button", { name: "Crimson" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "crimson");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "crimson");

  await page.getByRole("button", { name: "Appearance and language" }).click();
  await page.getByRole("link", { name: "فارسی" }).click();
  await expect(page).toHaveURL(/\/fa$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "crimson");
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
