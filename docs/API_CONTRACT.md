# Movie Discovery Platform — API Contract from Provided Documentation

**Status:** Documentation-derived contract; live responses have not yet been verified.

**Base URL:** `https://moviesapi.codingfront.dev`

This document records the API details supplied in the conversation. The endpoint shapes and example fields below are `Documented` based on the supplied documentation. Runtime status codes, actual current responses, CORS, availability, and edge cases remain `Unverified` until tested from the development environment.

## 1. Catalog endpoints

| Purpose | Method and path | Documented response shape | Notes |
|---|---|---|---|
| List movies | `GET /api/v1/movies?page={page}` | `{ data: MovieSummary[], metadata: PaginationMetadata }` | `page` is optional. The documented list excludes movies added by users. |
| Search movies | `GET /api/v1/movies?q={name}&page={page}` | `{ data: MovieSummary[], metadata: PaginationMetadata }` | `q` is required. Documentation says search includes catalog and user-submitted movies. Encode query parameters using `URLSearchParams`. |
| Movie details | `GET /api/v1/movies/{movie_id}` | `MovieDetails` object (not wrapped in `data` in the example) | `movie_id` is numeric. Example poster is a filename, unlike list examples that use an absolute URL. |
| Related movies | `GET /api/v1/movies/related/{movie_id}` | `MovieSummary[]` | Documentation says up to four random movies in the same genre. |
| Genres | `GET /api/v1/genres` | `Genre[]` | Example includes `id`, `name`, `movies_count`. |
| Movies by genre | `GET /api/v1/genres/{genre_name}/movies?page={page}` | `{ data: MovieSummary[], metadata: PaginationMetadata }` | **Ambiguous:** route says `genre_name`, parameter table describes a numeric path parameter, and prose says genre ID. Existing legacy code passes a genre name. Do not settle this by guessing; verify with a live request. |
| Random movies | `GET /api/v1/random_movies` | `MovieSummary[]` | Documentation describes four random movies. |

## 2. Documented TypeScript shapes

These types describe fields present in the examples. Optionality is intentionally conservative; widen/refine after capturing a real response.

```ts
export type MovieId = number;

export interface PaginationMetadata {
  current_page: number;
  per_page: number;
  page_count: number;
  total_count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  metadata: PaginationMetadata;
}

export interface Genre {
  id: number;
  name: string;
  movies_count: number;
}

export interface MovieSummary {
  id: MovieId;
  title: string;
  poster: string;
  genres: string[];
  images: string[];
}

export interface MovieDetails extends MovieSummary {
  year?: string | null;
  rated?: string | null;
  released?: string | null;
  runtime?: string | null;
  director?: string | null;
  writer?: string | null;
  actors?: string | null;
  plot?: string | null;
  country?: string | null;
  awards?: string | null;
  metascore?: string | number | null;
  imdb_rating?: string | null;
  imdb_votes?: string | null;
  imdb_id?: string | null;
  type?: string | null;
  language?: string | null;
  dvd?: string | null;
  box_office?: string | null;
  website?: string | null;
  production?: string | null;
  response?: string | null;
}
```

**Caution:** Documentation samples are not proof that every record contains all fields. The API may return `null`, omit fields, or vary formats. Keep parsing defensive and normalize data at the API boundary. The documented `images` field is an array of strings, not a single URL. The documented `imdb_rating` is a string in the detailed example. Runtime formatting differs between examples (`"142 min"` and `"170"`).

## 3. Image URL normalization

The documentation has inconsistent poster formats:

- List/related example: absolute URL such as `https://moviesapi.codingfront.dev/images/tt0111161.jpg`.
- Details example: basename such as `tt0111161_poster.jpg`.
- User-submitted movie example: absolute URL under `/images/`.

Normalize images in one adapter/helper, not in UI components:

1. If the value is a valid absolute HTTP(S) URL, validate/use it as-is.
2. If it is a basename, resolve it against `https://moviesapi.codingfront.dev/images/`.
3. If it is null, empty, or malformed, return `null` and show a local fallback image.
4. Test absolute URLs, bare filenames, empty strings, nulls, and malformed values.

If using `next/image`, configure only the required HTTPS hostname/path after verification. Do not use a broad wildcard remote-image policy. A plain `<img>` can be used temporarily during the prototype if image-host configuration is not settled, but image sizing and layout stability must still be handled.

## 4. Authentication and write endpoints (out of MVP scope)

The documentation also lists:

- `POST /api/v1/register`
- `POST /oauth/token` for password grant and refresh-token grant
- `GET /api/user` with a bearer token
- `POST /api/v1/movies/multi` for multipart movie submission

Do **not** integrate these in the current MVP. User-selected scope is a front-end demo using fixtures and `localStorage`; there is no requirement for real accounts or cross-device persistence. The documentation says registered user data is cleared weekly, which makes this service a poor default for durable account functionality. Do not send real passwords or personal data to it as part of the prototype.

## 5. Required API client behavior

- Use a single typed client and consistent response unwrapping; do not combine Axios interceptors that unwrap `response.data` with callers that unknowingly unwrap another level.
- Use `URLSearchParams` for search and pagination query parameters.
- Keep `MovieSummary` and `MovieDetails` distinct.
- Normalize API records to a small internal UI model at the boundary (for example, `id: string`, `rating: number | null`, normalized image URLs).
- Preserve unknown source fields only where needed; avoid leaking API-specific shapes into reusable UI components.
- Validate payloads defensively and provide fixture fallback when the network/API fails.
- Do not claim live API integration works until the actual `npm` app can make the requests from the intended runtime.

## 6. Live verification still required

The following remain `Unverified` even though example schemas are documented:

- Current availability and response status of each endpoint.
- Actual response JSON, empty result behavior, malformed IDs, and error payloads.
- Whether genre endpoint expects numeric ID or genre name.
- Browser CORS behavior from the deployed preview origin.
- Exact image URL behavior, redirects, and missing-image responses.
- Real pagination values and whether the response metadata always contains all four fields.
- Rate limits, caching headers, timeouts, and API stability.

Before wiring the live API into the UI, test each required read endpoint in the target environment and save representative sanitized JSON fixtures. The interface must continue to work with local fixtures when the external service is unavailable.
