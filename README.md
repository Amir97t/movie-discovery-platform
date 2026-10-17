# Movie Discovery Platform

A bilingual (English / Persian) movie-discovery frontend prototype with a shared four-theme design system (`gold` / `crimson` × `light` / `dark`).

> **Status: Milestone 0–1 prototype.** Only the Home page exists. The working brand name **FRAME** is temporary. All titles, ratings and artwork are fictional placeholder content; nothing is a real catalog. No backend, accounts or deployment.

## Scope

- Next.js App Router, TypeScript (`strict`), Tailwind CSS v4, `next-intl` (`/en`, `/fa` with correct `lang`/`dir`)
- Design tokens as CSS variables; palette and mode chosen independently, persisted in `localStorage`, applied before first paint
- Fixture-driven Home prototype (hero, genre list, responsive poster grid)
- Planned: Discover, Movie Details, and browser-local Favorites / Watchlist / Watched / ratings / comments / profile (`localStorage` only)

Design reference: [`docs/DESIGN_SYSTEM_AND_RESPONSIVE_PLAN.md`](docs/DESIGN_SYSTEM_AND_RESPONSIVE_PLAN.md).
API contract: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) (derived from owner-provided documentation). Live endpoint behavior, CORS and image availability remain **unverified**, so the Home page uses deterministic local fixtures.
Implementation status and known gaps: [`docs/IMPLEMENTATION_NOTES.md`](docs/IMPLEMENTATION_NOTES.md).

## Development

Requires Node.js ≥ 20.9 (`.nvmrc` pins 22).

```bash
npm install          # also generates package-lock.json (not committed yet)
npm run dev          # http://localhost:3000  → redirects to /en
npm run lint
npm run typecheck
npm test             # Vitest (unit/component)
npx playwright install chromium
npm run test:e2e     # builds, serves on :3100, runs responsive/theme checks
npm run build
```

Playwright writes screenshots to `screenshots/` (git-ignored).

## Structure

```
src/app/[locale]/        routes (layout, home, loading, not-found)
src/components/          layout/, ui/, movies/, appearance/
src/features/catalog/    types, fixtures, service, (experimental) API adapter
src/i18n/                routing, request config, navigation helpers
src/lib/                 appearance logic, pre-paint theme script
src/messages/            en.json, fa.json
src/styles/              tokens.css, globals.css
```
