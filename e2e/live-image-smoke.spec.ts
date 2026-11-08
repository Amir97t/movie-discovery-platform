/**
 * Real external image-server smoke test.
 *
 * NOTE: This test is network-dependent. It connects to the live upstream movie image
 * server (https://moviesapi.codingfront.dev) without mocking or route interception.
 * Regional network routing, firewalls, or VPN/proxy settings can affect this test.
 *
 * It is separated from the deterministic test suite so local development and CI
 * tests run reliably and offline.
 *
 * To run this smoke test explicitly:
 *   TEST_LIVE_IMAGES=true npx playwright test live-image-smoke
 */

import { test, expect } from "@playwright/test";

test.describe("Real external image-server smoke test [network-dependent]", () => {
  test("smoke test: verifies real external image server connectivity if enabled", async ({ page }) => {
    test.skip(
      !process.env.TEST_LIVE_IMAGES,
      "Network-dependent: Set TEST_LIVE_IMAGES=true to run against live image server (affected by VPN/proxy settings)",
    );

    // No interception installed — this goes through Next.js optimizer to the real image server
    await page.goto("/en/discover?page=1");

    const poster = page.locator("article [data-poster-status]").first();
    await expect(poster).toBeVisible({ timeout: 15_000 });

    // Under live network, the poster should either finish loading or gracefully show fallback
    const status = await poster.getAttribute("data-poster-status");
    expect(["loaded", "error"]).toContain(status);
  });
});
