# API Reconnaissance & Architecture — CodingFront Movies API

**Status:** Verified in Development & E2E Testing
**Host:** `https://moviesapi.codingfront.dev`
**API Base:** `/api/v1`

---

## 1. Verified Architecture Findings

During development and end-to-end test execution with both the live API and mock servers, the following behaviors were verified:

1. **Catalog Pagination:**
   - The default page returns 15 movie records.
   - Metadata is returned in `{ current_page, per_page, page_count, total_count }`.
   - String or numeric representations of page metadata are defensively normalized by `catalog-adapter.ts`.

2. **Genre Path Format:**
   - The route `GET /api/v1/genres/{genre_name}/movies` expects the capitalized genre name (e.g. `Drama`, `Action`, `Crime`).
   - Genres with spaces or special characters are safely mapped via `GENRE_KEY_TO_API_NAME`.
   - Genres present in the UI but absent from the live API (such as `Documentary`) are automatically caught and resolved against rich local fixtures.

3. **Image Normalization:**
   - List endpoints generally provide full absolute image URLs (`https://moviesapi.codingfront.dev/images/...`).
   - Detail endpoints frequently provide bare filenames (e.g. `tt0111161.jpg`).
   - The adapter normalizes all relative filenames to `https://moviesapi.codingfront.dev/images/{filename}`.
   - Wide images from `images[]` are parsed as `backdropUrl`, while portrait artwork is parsed as `posterUrl`.

4. **Out-of-Scope Endpoints:**
   - Authentication routes (`/oauth/token`, `/api/user`, `/api/v1/register`) are intentionally omitted.
   - To preserve privacy and prevent credential exposure, the platform uses browser-local storage for all user data and makes zero authenticated requests to the backend.

---

## 2. Fallback Verification

The application ensures 100% catalog availability through its hybrid architecture:
- When the live API is responsive, real movies and IMDb data are rendered.
- If the live API is unreachable, offline, or returns 5xx/404 errors, the service cleanly falls back to deterministic bilingual fixtures.
- All fixtures feature complete metadata, bilingual synopses, and local SVG poster artwork.
