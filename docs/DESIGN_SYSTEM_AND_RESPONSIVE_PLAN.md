# Movie Discovery Platform — Design System & Responsive Implementation Plan

**Status:** Ready for implementation planning; not yet implemented in a repository
**Working brand name:** FRAME (temporary only; final brand name is undecided)
**Suggested repository slug:** `movie-discovery-platform` (check availability before creating)
**Product type:** Bilingual movie-discovery and personal-library frontend demo
**Locales:** English (`en`) and Persian (`fa`)
**MVP data:** Existing CodingFront movie API where verified, plus local fixtures as a reliable fallback
**Persistence:** Browser-local only (`localStorage`); no real accounts, server database, or cross-device sync in MVP

---

## 1. Product and design decisions

### Product vision

Build a distinctive cinematic discovery experience with the visual polish of an editorial film publication and useful personal-library interactions. It should not look like a direct Netflix or IMDb clone.

### Core user tasks

1. Discover films and browse by genre.
2. Search for a film and open its details.
3. Add/remove a film from Favorites.
4. Add/remove a film from Watchlist.
5. Mark/unmark a film as Watched.
6. Record, update, or clear a personal rating.
7. Add and delete a local demo comment for a film.
8. View and edit a lightweight local demo profile.
9. Change language, palette, and light/dark appearance without losing the current route.

### MVP boundary

All user interactions must genuinely work in the browser and persist through refresh. They are local to the current browser profile. Do not represent them as public, multi-user, account-backed features. Authentication, server-side storage, public comments, follows, replies, streaming, and recommendations powered by AI are out of scope.

---

## 2. Visual direction

### Art direction

- Cinematic, premium, editorial, confident.
- Film artwork is the visual focus; interface chrome should remain restrained.
- Use large landscape artwork sparingly for featured content, plus consistent portrait posters for the catalog.
- Use strong typography and intentional negative space instead of excessive borders, gradients, glass effects, or nested cards.
- Use motion to communicate state and hierarchy, not as decoration.
- Keep the existing movie API as a potential data source, not as a design constraint.

### Two palette families × two appearance modes

Implement one shared design system, not four separate themes. Use CSS custom properties and data attributes so that switching a palette changes tokens without changing component structure.

Recommended state model:

- `palette`: `gold` or `crimson`
- `mode`: `light`, `dark`, or `system`
- Persist user choices locally.
- If `mode === system`, resolve light/dark appearance from `prefers-color-scheme`.
- Apply appearance before the page visibly paints to avoid a theme flash.
- Manual light/dark selection overrides the operating-system setting.
- Keep the chosen palette when the appearance mode changes.

Suggested DOM contract: `data-palette="gold|crimson"` plus `data-mode="light|dark"` on the root element. The implementation may use a theme library if it reduces complexity, but it must not introduce unnecessary duplicated state or a flash of the wrong theme.

### Initial color tokens

These are starting values, not immutable brand colors. Validate contrast after implementation and adjust tokens rather than patching individual components.

| Token | Noir Gold / Dark | Noir Gold / Light | Crimson Cinema / Dark | Crimson Cinema / Light |
|---|---|---|---|---|
| `--background` | `#101114` | `#F7F5EF` | `#101114` | `#F8F4F4` |
| `--surface` | `#191A1F` | `#FFFFFF` | `#191A1F` | `#FFFFFF` |
| `--surface-raised` | `#242429` | `#FFFDF8` | `#252327` | `#FFF8F8` |
| `--border` | `#34353C` | `#E4E0D6` | `#3A3438` | `#E7D8DA` |
| `--text-primary` | `#F5F3EF` | `#201E19` | `#F5F3EF` | `#241A1D` |
| `--text-muted` | `#A3A3AA` | `#6C6A63` | `#A7A0A4` | `#75676B` |
| `--accent` | `#F2B544` | `#885600` | `#E5484D` | `#B42332` |
| `--accent-hover` | `#FFD36E` | `#704800` | `#F7686C` | `#941B28` |
| `--accent-foreground` | `#17130A` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `--favorite` | `#E5484D` | `#C92D3A` | `#E5484D` | `#B42332` |

Also define semantic tokens once for success, warning, destructive/error, focus ring, overlay, skeleton, and disabled states. These semantic states must remain understandable in both palettes and both modes; never use color as the only signal for an error or selected state.

### Design tokens and component consistency

Centralize tokens for:

- Color and semantic states.
- Typography scale and line heights.
- Spacing scale based on a consistent 4/8 px rhythm.
- Radius, border, shadow, and overlay levels.
- Content widths and responsive gutters.
- Focus ring thickness/offset.
- Motion duration and easing.

Avoid one-off literal colors, spacing values, or radii inside unrelated components unless a documented exception is necessary.

---

## 3. Typography

### Recommended direction

- English: Geist Sans or another clear modern UI sans serif.
- Persian: Vazirmatn or an equivalent readable Persian family.
- Prefer variable WOFF2 files where practical and licensing permits.
- Prefer self-hosted/local font assets for predictable runtime behavior. If local files are not initially available, use a build-time font strategy with a robust system fallback; avoid runtime font requests to third-party domains.
- Use `next/font/local` when licensed font files are available. Do not commit font assets without checking the license and the repository's asset policy.

### Typography behavior

- Define a deliberate scale for display heading, page heading, section heading, card title, body, metadata, and labels.
- Use `clamp()` for display text only when it helps smooth scaling; keep body and control sizing predictable.
- Persian and English need separate checks for line-height, letter/word spacing, truncation, and wrapping.
- Movie titles can occupy up to two lines in cards without changing card height.
- Never rely on text alignment alone to create RTL. Set the correct document language and direction and use logical CSS properties (`margin-inline`, `padding-inline`, `inset-inline`, etc.).

---

## 4. Iconography and motion

### Icons

Use one coherent icon set (recommended: Lucide React) and import only icons that are used. Use consistent stroke weight and optical size. Always supply accessible names for icon-only controls via a visible label or `aria-label`; decorative icons should be hidden from assistive technology.

Suggested mapping:

- Search: `Search`
- Favorite: `Heart`
- Watchlist: `Bookmark` or `ListPlus`
- Watched: `Eye` or a clearly labeled check state
- Personal rating: `Star`
- Comments: `MessageCircle`
- Library: `LibraryBig` or `Bookmark` (choose one canonical symbol)
- Profile: `UserRound`
- Palette/appearance: `Sun`, `Moon`, `Monitor`, `Palette`
- Language: `Languages`
- Mobile menu: `Menu`, `X`
- Filters: `SlidersHorizontal`

Do not use emoji as interface icons. Create a custom brand mark for favicon/logo once a direction is chosen.

### Motion rules

- Micro-interactions: roughly 140–200 ms.
- Favorite/rating feedback: roughly 160–240 ms.
- Menu, popover, and panel transitions: roughly 180–280 ms.
- Larger content transitions: roughly 220–320 ms, used selectively.
- Prefer opacity and transform-based animation. Avoid animating layout-heavy properties continuously.
- CSS transitions are preferred for simple hover/focus/color changes; use Motion for React only where coordinated or stateful motion materially improves UX.
- Honor `prefers-reduced-motion`. Replace large movement with subtle opacity changes and disable parallax or autoplay-like motion.
- Avoid autoplay background video, perpetual ambient motion, and scroll-jacking.

---

## 5. Responsive strategy

### Mobile-first rule

Build the base layout for a narrow mobile viewport first, then enhance it at larger breakpoints. Breakpoints are layout constraints, not rigid definitions of device type; test intermediate widths too.

Use Tailwind's standard mobile-first breakpoints unless actual content testing proves a custom breakpoint is necessary:

| Range | Typical use | Default layout behavior |
|---|---|---|
| `< 640px` | Mobile | One compact header, two poster columns, stacked details, drawer menu, optional bottom navigation |
| `640–767px` | Large mobile / small tablet | Three poster columns when card readability permits; more horizontal breathing room |
| `768–1023px` | Tablet | Three columns by default; compact but expanded navigation; selected split layouts when space allows |
| `1024–1279px` | Small desktop / landscape tablet | Four poster columns; full navigation; two-column detail layout |
| `1280–1535px` | Desktop | Five poster columns where content width supports it; full editorial layout |
| `1536px+` | Wide desktop | Preserve readable max width; do not stretch content edge-to-edge |

Breakpoints map to 40rem (`sm`), 48rem (`md`), 64rem (`lg`), 80rem (`xl`), and 96rem (`2xl`) under default Tailwind settings. Confirm the actual values from the installed Tailwind version instead of assuming defaults after customization.

### Global layout

- Main content max width: approximately 1280px.
- Horizontal page gutters: 16px on narrow mobile; 20–24px on larger mobile/tablet; 28–32px on desktop.
- Use fluid widths, grid/flex constraints, `minmax()`, `clamp()` where appropriate, and `min-width: 0` for text/grid children.
- Prevent unintended horizontal scrolling at all required viewport sizes.
- Respect safe-area insets if mobile bottom navigation is used.

### Header and navigation

**Mobile:**
- Compact header with brand mark, search affordance, appearance/language controls, and an accessible menu/drawer.
- Avoid placing every navigation link and every settings control in one cramped row.
- Evaluate a fixed bottom bar for Home, Discover, Library, and Profile. If chosen, it must not cover content, should respect safe areas, and should have clear active states. Treat it as an explicit design decision during the Home prototype rather than adding it automatically.

**Tablet:**
- Keep the header compact. Use inline links only if labels fit without wrapping or crowding; otherwise use a menu/drawer.

**Desktop:**
- Full horizontal navigation with a clear search entry point and grouped appearance/language controls.
- Avoid oversized fixed headers that consume too much vertical space.

### Home / hero

- Desktop: wide cinematic backdrop with a restrained gradient for text contrast; content and CTA aligned to reading direction.
- Tablet: shorter hero with fewer metadata items and no overlap with the following section.
- Mobile: reduce hero height, prioritize title and primary CTA, and move secondary metadata below the main visual if needed. Keep enough of the first catalog section visible without excessive scrolling.
- The hero image must have a reserved aspect ratio/height to prevent layout shift. Do not load multiple large hero assets eagerly.

### Movie grid and cards

- Start with two columns on narrow mobile, three at `sm`, three at `md` where card width requires it, four at `lg`, and up to five at `xl` only when each card remains readable.
- Poster ratio around 2:3 with `object-fit: cover`.
- Keep card geometry consistent even if title length, rating availability, or poster data differ.
- Clamp card titles to two lines; expose the complete title on the details page and through accessible text.
- Make the entire intended clickable region obvious without nesting interactive elements inside a link.
- Touch targets should be comfortably usable; aim for 44×44 CSS px for primary touch controls when practical.

### Movie details

- Mobile: single-column flow with poster/hero, title, metadata, actions, synopsis, then comments.
- Tablet: use a split layout only when the content area can support readable line length; otherwise keep the stacked layout.
- Desktop: two-column details layout with artwork on one side and content/actions on the other, followed by related content/comments.
- Prevent the action row from overflowing when localized labels are longer in Persian.

### Library and profile

- Mobile: tabs or filter chips may scroll horizontally; never allow them to force page-level horizontal scrolling.
- Desktop: tabs can be inline with counts and optional sorting controls.
- Empty states must remain useful and visually balanced at every width.
- Profile statistics should wrap to a sensible grid and must not force narrow labels into unreadable columns.

### Forms, menus, dialogs

- Full-width fields on mobile; appropriate maximum width on desktop.
- Menus and dialogs must fit in the viewport and have a usable close path.
- Support keyboard focus, Escape-to-close where appropriate, and focus restoration.
- Avoid hover-only functionality because touchscreens do not reliably provide hover.

---

## 6. Bilingual and RTL requirements

Use locale-aware routes and a maintained internationalization solution suited to the Next.js App Router (recommended candidate: `next-intl`). Proposed routes:

- `/en`
- `/en/discover`
- `/en/movies/[id]`
- `/en/library`
- `/en/profile`
- matching `/fa/...` routes

Requirements:

- Set `lang="en"` and `dir="ltr"` for English; `lang="fa"` and `dir="rtl"` for Persian.
- Switching language should preserve the equivalent route and movie ID.
- Translate navigation, metadata labels, actions, form validation, empty states, error messages, dates/numbers when relevant, and accessibility labels.
- Use CSS logical properties instead of hardcoded left/right positioning where possible.
- Test mixed-script titles, digits, punctuation, star ratings, and long Persian strings.
- Avoid assuming that icons should all be mirrored in RTL; mirror only directional icons whose meaning depends on reading direction.

---

## 7. Favicon and brand assets

Final brand name is not chosen yet, so start with an original symbol that works independently of the wordmark. Explore a geometric film-frame/aperture concept; avoid copying an existing streaming brand's mark.

Required exports after the symbol is approved:

- `favicon.svg`
- standard favicon assets for common browser sizes/formats where needed
- `apple-touch-icon.png` (180×180)
- `opengraph-image` or equivalent 1200×630 social preview
- wordmark/brand lockup in SVG if a wordmark is approved

Constraints:

- The mark must remain recognizable at 16×16 and 32×32.
- Avoid fine detail, small text, and thin strokes.
- Check visibility on browser light and dark chrome.
- Use high-contrast variants if one color cannot work across both modes.
- Keep brand artwork as optimized SVG/PNG rather than shipping a full icon/illustration library for the logo.

---

## 8. Recommended technical stack

Select mutually compatible stable versions during repository initialization and commit the lockfile. Do not blindly install latest versions of every package without checking compatibility.

- Next.js App Router + React + TypeScript (`strict`)
- Tailwind CSS
- `next-intl` candidate for locale-aware routes and messages
- Lucide React for icons
- Motion for React only for interactions that need it
- `next/image` for images, with explicit remote image configuration and correct `sizes`
- Vitest + React Testing Library for unit/component tests
- Playwright for key end-to-end and responsive checks

Avoid adding a full UI kit unless a specific requirement justifies it. Build a small set of reusable components from a shared token system; do not reinvent basic accessibility patterns unnecessarily.

### Suggested app structure

```text
src/
  app/
    [locale]/
      layout.tsx
      page.tsx
      discover/page.tsx
      movies/[id]/page.tsx
      library/page.tsx
      profile/page.tsx
      not-found.tsx
  components/
    layout/
      site-header.tsx
      mobile-navigation.tsx
      site-footer.tsx
    ui/
      button.tsx
      icon-button.tsx
      badge.tsx
      input.tsx
      tabs.tsx
      dialog.tsx
      skeleton.tsx
      empty-state.tsx
    movies/
      movie-card.tsx
      movie-grid.tsx
      movie-hero.tsx
      movie-details.tsx
      movie-actions.tsx
      movie-rating.tsx
      movie-comments.tsx
    library/
      library-tabs.tsx
      library-grid.tsx
    profile/
      profile-summary.tsx
    appearance/
      appearance-menu.tsx
  features/
    catalog/
      catalog-types.ts
      catalog-service.ts
      catalog-fixtures.ts
    personal-library/
      library-types.ts
      library-storage.ts
      library-store.ts
  i18n/
    routing.ts
    request.ts
    navigation.ts
  messages/
    en.json
    fa.json
  styles/
    tokens.css
    globals.css
public/
  icons/
  images/
docs/
  DESIGN_SYSTEM_AND_RESPONSIVE_PLAN.md
  IMPLEMENTATION_PLAN.md
```

This is a starting map, not permission to create abstractions that do not have a real use. Keep it smaller if the first implementation proves some folders unnecessary.

---

## 9. Performance rules

- Use responsive image sizing and the Next.js image pipeline where appropriate; configure allowed remote hosts explicitly after verifying the API's actual image hosts.
- Give the hero/LCP image a correct reserved size and eager/priority behavior only if it is truly the page's critical image; defer below-the-fold posters.
- Avoid loading every movie image on initial render.
- Use stable card dimensions to limit layout shift.
- Avoid client components by default; use server components for static page structure and data where possible, and client components for actual browser interactions/local storage.
- Keep local-storage access behind client boundaries and robust error handling.
- Do not animate layout dimensions on every scroll or pointer movement.
- Avoid adding large animation, UI, or state libraries for one small component.
- Measure a production build on the deployed site; do not claim performance gains without measurements.

Suggested real-user Core Web Vitals goals at the 75th percentile when field data becomes available: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1. For early lab checks, record mobile Lighthouse results and work on the largest measured bottlenecks first. Treat a Mobile Performance score of 90+ as a target, not a guarantee or the only definition of good performance.

---

## 10. Test matrix and acceptance criteria

### Viewports

Test at minimum:

- 360×800 — narrow mobile
- 390×844 — common mobile size
- 640×900 — small breakpoint boundary
- 768×1024 — tablet portrait
- 1024×768 — tablet landscape / small laptop
- 1280×800 — desktop
- 1440×900 — common desktop
- 1920×1080 — wide desktop overflow check

Also check intermediate widths near breakpoints, not only the exact listed sizes.

### Visual regression matrix

At minimum, compare Home and Movie Details in all four explicit appearance combinations (`gold-light`, `gold-dark`, `crimson-light`, `crimson-dark`) at mobile, tablet, and desktop reference widths. That is 24 core page/state combinations before checking other interactive states.

Screenshots should use stable fixture data, predictable font/image loading, reduced animation during capture, and a consistent browser/device scale. Compare meaningful geometry and rendering rather than blindly treating every antialiasing difference as a defect.

### Functional acceptance

- Every navigation item has a working destination.
- Search and genre filters handle empty, success, and error results.
- Favorite, Watchlist, Watched, personal rating, comments, and demo profile work independently and persist after refresh.
- Invalid or missing movie IDs show a designed not-found state.
- API failure still leaves an inspectable app via fixtures.
- Persian and English routes work and switching locale preserves the equivalent page/movie ID.
- Each of the four themes has checked text/background contrast, focus visibility, and control states.
- No page-level horizontal overflow at tested widths.
- All key actions work using keyboard; controls have accessible names; reduced-motion is respected.
- Production build, lint, type-check, unit/component tests, and key Playwright journeys pass.
- Favicon, page title/metadata, and social preview are present.

### Completion definition

A feature is not done because its component renders. It is done when the visual states, responsive behavior, persistence (where applicable), keyboard operation, errors, tests, and documentation are verified.

---

## 11. Implementation milestones

### Milestone 0 — Repository and API reconnaissance

1. Create a new repository; preserve the old repository unchanged.
2. Inspect the current `Amir97t/movie` code and public API only to learn the data contract and reuse useful knowledge—not to carry forward the old layout by default.
3. Verify API availability, response types, pagination, search/filter behavior, CORS, image hosts, and likely failure cases.
4. Define typed catalog interfaces and a local fallback fixture set.
5. Choose compatible package versions and commit the lockfile.
6. Add README with project scope and development commands.

**Gate:** report what is known about the API, what remains unverified, proposed folder structure, dependency choices, and tests before building full pages.

### Milestone 1 — Design foundation

1. Establish design tokens for all four theme combinations.
2. Set up English/Persian routing and direction.
3. Configure font loading and fallbacks.
4. Build base layout, responsive header, appearance menu, language switch, button, icon button, movie-card skeleton, and empty state.
5. Implement favicon/logo draft after selecting an abstract mark direction.
6. Verify theme persistence, no initial flash, keyboard access, and reduced motion.

**Gate:** review one Home wireframe/prototype across mobile, tablet, and desktop in all four themes before implementing the full site.

### Milestone 2 — Catalog pages

Build Home, Discover, Movie Details, fixtures/API adapter, loading/empty/error states, and responsive image behavior.

### Milestone 3 — Local personal features

Build Favorites, Watchlist, Watched, personal ratings, local comments, and demo profile with versioned local storage.

### Milestone 4 — Quality and polish

Run functional tests, responsive checks, visual regression captures, accessibility review, and production performance checks. Fix regressions before adding polish.

### Milestone 5 — Publish and present

Deploy the demo, add screenshots and architecture notes to README, document the local-only behavior, and produce a concise before/after portfolio case study explaining AI-assisted workflow and how correctness was verified.

---

## 12. Engineering workflow for AI tools

- Start with a read-only audit before editing an existing codebase.
- Work on a new branch and make small, reviewable changes.
- Before each milestone, provide a concise plan and acceptance criteria.
- Do not silently add dependencies or rewrite unrelated files.
- After each meaningful change, run lint, type-check, build, and focused tests available for the project.
- Do not claim tests passed unless the commands were actually run and their results inspected.
- Prefer clear, idiomatic TypeScript over clever abstractions.
- Review generated code for accessibility, routing, RTL, local-storage corruption cases, and API errors.
- Keep actual user-facing comments local and label them as demo data; never imply cross-user sharing.
- Record significant decisions and meaningful changes in commits.

---

## Official references

- Next.js font optimization: https://nextjs.org/docs/app/getting-started/fonts
- Next.js image component: https://nextjs.org/docs/app/api-reference/components/image
- Tailwind responsive design: https://tailwindcss.com/docs/responsive-design
- Motion reduced-motion/accessibility: https://motion.dev/docs/react-accessibility
- next-intl routing: https://next-intl.dev/docs/routing/configuration
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Core Web Vitals thresholds: https://web.dev/articles/defining-core-web-vitals-thresholds/
