# Implementation notes — Milestone 0 + 1 (Home prototype)

Status labels: **Verified** (run/observed), **Inferred**, **Unverified** (written but not run).

## What exists

- Next.js App Router + TypeScript strict + Tailwind v4 + `next-intl` (`/en`, `/fa`), Home prototype with fixtures, four-theme token system, responsive header, bottom navigation (< md), appearance/language menu, favicon draft.
- Not built on purpose: Discover, Movie Details, Library, Profile, local personal features, API client, deployment.

## Environment limits for this audit

| Check | Result |
|---|---|
| Dependency installation | **Blocked / incomplete** — `npm install --ignore-scripts --no-audit --no-fund` timed out after 120 seconds. No `node_modules/` or `package-lock.json` was produced. The exact network cause could not be diagnosed from this run. |
| Strict TypeScript check | **Passed for pure modules only** using global TypeScript 5.8.3: catalog types, fixtures, adapter, catalog service, and appearance utilities/store. Not a full project typecheck. |
| TS/TSX syntax | **Passed** — `transpileModule` reported zero syntax errors across all 42 `.ts`, `.tsx`, and `.mts` files. This does not type-check external package APIs. |
| JSON syntax | **Passed** — every JSON file in the archive parsed successfully. |
| Local runtime smoke checks | **Passed** — 17 Node assertions against compiled pure modules for image normalization, movie normalization, list envelopes, fixtures, and appearance helpers. These are not the Vitest suite. |
| Real Vitest / ESLint / Next.js build / Playwright | **Unverified** — dependencies could not be installed in this environment, so these commands have not run. |
| Browser rendering, screenshots, four-theme matrix, RTL visuals, theme flash and keyboard behaviour | **Unverified** — no browser run has been performed. |

Do not describe the project as build-verified until `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all complete successfully in a network-capable development environment. Playwright additionally requires its Chromium browser installation.

## API documentation and adapter

- The project owner supplied endpoint descriptions and sample JSON from the official API documentation. These are captured in [`API_CONTRACT.md`](./API_CONTRACT.md).
- Live responses, status codes, CORS, latency, and image availability remain **Unverified** because this environment could not perform a live HTTP request.
- `catalog-adapter.ts` now normalizes documented poster formats (absolute HTTPS API URL, root-relative path, or bare filename) and keeps the first `images[]` item as a separate `backdropUrl`. It rejects unknown image hosts so `next/image` remains compatible with the explicit remote-host allowlist.
- The Home page still uses deterministic fictional fixtures. The adapter is tested in source but is not yet wired into the live catalog service; API wiring should wait until the user runs a browser/network check.

## Theme system

- DOM contract: `<html data-palette="gold|crimson" data-mode="light|dark" data-mode-pref="light|dark|system">`.
- `THEME_INIT_SCRIPT` (inline in `<head>`) applies stored choice before first paint; the server HTML ships `gold`/`dark` defaults and `suppressHydrationWarning` on `<html>`. Parity between script and `applyAppearance` is unit-tested (**Verified** with fakes). Absence of a real flash is **Unverified**.
- `useSyncExternalStore` reads the `<html>` attributes, so there is no duplicated React state; `system` mode follows `prefers-color-scheme` changes while the app is open.
- Storage failures (blocked/quota/corrupt JSON) fall back to defaults without throwing (**Verified** in unit tests).

### Contrast (WCAG 2.x formula, computed on `tokens.css`, **Verified**)

| Theme | Text | Muted | Accent as text | Accent-fg on accent | Semantic text | Control outline | Focus ring |
|---|---|---|---|---|---|---|---|
| gold-dark | 13.94 | 6.16 | 8.44 | 10.11 | 5.99 | 3.80 | 12.24 |
| gold-light | 15.27 | 4.97 | 5.70 | 6.22 | 4.60 | 3.51 | 7.36 |
| crimson-dark | 14.05 | 6.09 | 4.59 | 5.57 | 5.99 | 3.67 | 5.92 |
| crimson-light | 15.51 | 4.92 | 5.96 | 6.51 | 4.60 | 3.75 | 7.86 |

(Minimum across surfaces; requirement 4.5:1 text, 3:1 non-text.) `src/styles/tokens.test.ts` enforces this.

Adjustments to the plan's starting tokens, found by calculation:
- crimson-dark: white on `#E5484D` was 3.91:1 and the accent as text on `surface` 4.44:1, so `--accent` → `#EC5A5F`, `--accent-foreground` → `#101114`.
- Plan borders are 1.2–1.55:1, fine for dividers but not for control outlines; added `--border-strong` for outlined controls.
- Contrast of text on the hero artwork is not computed from tokens; the hero uses a fixed dark scrim and light text, **Unverified visually**.

## Fonts

- `next/font/google` (Geist, Vazirmatn) is used at build time, so fonts are self-hosted by Next.js with no runtime Google request. **Unverified**: the build was never run here, so the export names/subsets and network access at build time are untested.
- No font files are committed (no licence/asset review done). CSS stacks fall back to system fonts if a font fails to load.
- Alternative if the build cannot reach Google Fonts: add licensed files and switch to `next/font/local`.

## Navigation decision (prototype)

- Bottom bar (Home, Discover, Library, Profile) below `md`, header inline links from `md`, one menu for language + palette + mode — matching the proposed default. It is the explicit decision point for the Home review.
- Discover/Library/Profile do not exist yet; they render as `aria-disabled` placeholders with a screen-reader "coming soon", not dead links. Search is also not present yet.

## Audit corrections made after receiving `movie-discovery-platform.zip`

- The mobile bottom navigation is fixed to the viewport. To keep it from covering the final footer area, bottom safe-area spacing is now applied to the document body (after the footer), rather than only before the footer inside `<main>`. The existing Playwright check is intended to verify this but has not been run in a browser here.
- `Movie` now keeps `posterUrl` and `backdropUrl` distinct. The API adapter no longer treats a wide backdrop as a portrait poster when the poster field is missing.
- `next.config.ts` permits Next Image only for HTTPS images under `moviesapi.codingfront.dev/images/**`, matching the owner-provided examples. A live image request is still unverified.

## Known gaps

- No `package-lock.json`; dependency ranges use caret ranges (and a range for `lucide-react`) and need a first install to resolve and lock.
- Language switch keeps the pathname but drops query string/hash and does not yet handle dynamic segments (no dynamic routes exist yet).
- `not-found.tsx` locale resolution inside the locale layout is **Unverified**.
- No OG image, apple-touch-icon or PNG favicons yet (only `src/app/icon.svg`).
- Playwright browsers must be installed (`npx playwright install chromium`) before `npm run test:e2e`.
