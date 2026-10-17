# API reconnaissance — CodingFront Movies API

Status labels:
- **Documented**: present in the API documentation excerpt supplied by the project owner.
- **Inferred**: deduced from the existing `Amir97t/movie` client code.
- **Unverified**: requires a live request or browser test; no live API request has been completed in this environment.

## Summary

The project owner supplied endpoint descriptions and sample JSON from `https://moviesapi.codingfront.dev/`. The documented contract is recorded in [`API_CONTRACT.md`](./API_CONTRACT.md). This updates the earlier investigation: the docs are now available as user-provided source material, although this environment has not independently fetched the docs site or verified live responses.

## Important boundaries

- `https://moviesapi.codingfront.dev/api/v1` is the documented API base path.
- List/search/genre pages return an object with `data` and `metadata` in the provided examples.
- Detail returns a single movie object in the provided example.
- Related/random endpoints return bare arrays in the provided examples.
- Poster URLs vary in format: list examples show a complete URL while the details example shows a filename. The adapter resolves filenames against `/images/` and keeps the `images` array as backdrop candidates.
- The genre route is ambiguous: its placeholder is `genre_name`, while its parameter table/prose describe a numeric ID. The existing client passes a genre name. Verify with a live request before wiring genre filtering to the service.
- The related endpoint description says four movies, but the sample shows only two. Treat the count as not guaranteed until tested.
- `POST /api/v1/register`, `POST /oauth/token`, `GET /api/user`, and `POST /api/v1/movies/multi` are out of scope for the current local-only frontend MVP. Do not send real credentials or personal data to this service.

## Current application status

The Home page deliberately uses fictional local fixtures so the design prototype remains deterministic. `catalog-adapter.ts` is an isolated normalization layer covered by unit tests; it is not yet connected to Home. This is intentional until a local browser can verify endpoint responses, CORS if browser requests are used, image loading, and failure behavior.

## Live verification still required

- HTTP status and real response bodies for every endpoint used by the app.
- Actual optional/null field behavior and pagination metadata.
- Whether genre path accepts a name or numeric ID.
- CORS behavior from the intended deployed origin (only required if requests run in the browser).
- Image URL redirects and missing-image behavior.
- API availability, rate limits, caching, and latency.
- Error responses for empty results, invalid IDs and unavailable service.

Do not label the live API integration as working until these checks are run in the target environment.
