# FRAME · Movie Discovery & Personal Library Platform

A high-polish, bilingual (English / Persian) movie discovery and personal film management frontend platform with a cinematic four-theme design system (`gold` / `crimson` × `light` / `dark`), full responsive navigation, resilient API integration, and browser-local personal library persistence.

> **Status:** Production-ready MVP portfolio project. Fully functional across all 6 localized routes with 272 passing unit/component tests and an exhaustive Playwright E2E suite.

---

## Highlights & Features

- **Bilingual Interface (English LTR & Persian RTL):** Complete localization via `next-intl` with proper bidirectional typography (`Geist` for Latin, `Vazirmatn` for Arabic/Persian) and zero-width non-joiner (`\u200C`) character handling.
- **Cinematic Four-Theme System:** Shared design token architecture supporting `gold` and `crimson` palettes in both `light` and `dark` modes. Zero-flash pre-paint initialization script prevents flash of unstyled content.
- **Resilient Catalog Discovery:** Integrated with `https://moviesapi.codingfront.dev/` with automatic fallback to deterministic local fixtures when the upstream API is unavailable.
- **Hero Carousel & Discover Hero:** Editorial featured presentation with accessible playback controls, touch/swipe navigation, and responsive layout across desktop, tablet, and mobile.
- **Genre-Based Filtering & Live Search:** Explore movies by 20+ genres with URL query state synchronization, pagination, and empty/error handling.
- **Movie Details:** Comprehensive movie presentation with landscape backdrops, portrait posters, SVG artwork fallbacks, IMDb metadata, and integrated personal interaction controls.
- **Browser-Local Personal Library:**
  - **Favorites, Watchlist, & Watched:** 3 dedicated personal collections with instant card-level toggles and detail actions.
  - **Personal Ratings:** Granular 0–10 scale rating with 0.5 increments, accessible slider and star controls, and clear/reset capability.
  - **Local Comments:** Private notes and critique (up to 1,000 characters) saved privately to browser storage with safe plain-text rendering.
  - **Personal Statistics:** Live 6-card profile dashboard computing total movies saved, watch progress, rated count, average rating (supporting 0.0 ratings), top genres, and comment counts.
  - **Data Portability (Export & Import):** Client-side JSON backup generation and structured import with preview, schema validation, and deterministic conflict resolution.
  - **Safe Data Reset:** Guarded full data reset protected by explicit confirmation text (`RESET`).
- **Liquid Navigation Indicator:** Animated frosted-glass pill indicator on desktop header and mobile bottom navigation with reduced-motion support.

> **Data Privacy Notice:** All personal features (Favorites, Watchlist, Watched, Ratings, Notes, Profile) are strictly browser-local (`localStorage`). No user accounts, credentials, or personal data are transmitted to any server.

---

## Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack, Server & Client Components) |
| **Runtime & UI** | React 19, TypeScript (`strict` mode) |
| **Styling** | Tailwind CSS v4, CSS Custom Properties (Design Tokens) |
| **Localization** | `next-intl` (Route-based `/en` and `/fa`, RTL/LTR) |
| **Icons** | `lucide-react` |
| **State Synchronization** | `useSyncExternalStore` for reactive `localStorage` and cross-tab updates |
| **Testing** | Vitest (unit/component), Playwright (end-to-end), Testing Library |

---

## Route Structure

- `/[locale]` — Home page with Featured Carousel, Genre filter list, and 15-item movie catalog.
- `/[locale]/discover` — Discover page with Discover Hero, Genre sidebar, responsive grid, and pagination.
- `/[locale]/search` — Real-time and URL-persisted search with debounced input, query results, and empty states.
- `/[locale]/movies/[id]` — Movie detail page with backdrops, metadata, personal actions, rating slider, and notes.
- `/[locale]/library` — Personal Library with 3 collection tabs (Favorites, Watchlist, Watched), sorting, and snapshots.
- `/[locale]/profile` — Profile dashboard with demo profile editor, live statistics, JSON export/import, and reset.

---

## Development & Testing

Requires Node.js ≥ 20.9 (`.nvmrc` pins 22).

### Setup

```bash
# Clone the repository
git clone https://github.com/Amir97t/movie-discovery-platform.git
cd movie-discovery-platform

# Install dependencies
npm install

# Start development server
npm run dev
# Open http://localhost:3000 -> automatically redirects to /en
```

### Verification & Testing

```bash
# Run strict TypeScript check
npm run typecheck

# Run ESLint check
npm run lint

# Run Vitest unit & component test suite (19 test files, 272 tests)
npm test

# Run Playwright end-to-end test suite
npx playwright test

# Build production bundle
npm run build
```

---

## Known Boundaries & Limitations

1. **Browser-Local Persistence:** Personal data is tied to the current browser's `localStorage`. Clearing browser data or using incognito mode resets personal library data.
2. **Upstream API Limits:** The external movie API (`https://moviesapi.codingfront.dev`) has a fixed catalog. For genres not backed by the API (e.g. Documentary), deterministic local fixtures provide full rich detail and SVG artwork.
3. **Demo Profile:** The user profile (display name, bio) is local to the device and does not connect to an authentication provider.

---

## License

MIT
