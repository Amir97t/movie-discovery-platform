import { FIXTURE_MOVIES, type FixtureMovie } from "./catalog-fixtures";
import { normalizeMovie, normalizeMovieList } from "./catalog-adapter";
import {
  GENRE_KEYS,
  type CatalogLocale,
  type CatalogState,
  type GenreKey,
  type HomeCatalog,
  type Movie,
} from "./catalog-types";

/** Thrown when the detail endpoint returns HTTP 404 for a requested movie id. */
export class MovieNotFoundError extends Error {
  constructor() { super("Movie not found"); this.name = "MovieNotFoundError"; }
}

export function fixtureToMovie(fixture: FixtureMovie, locale: CatalogLocale): Movie {
  return {
    id: fixture.id,
    title: fixture.title[locale],
    year: fixture.year,
    rating: fixture.rating,
    runtimeMinutes: fixture.runtimeMinutes,
    genres: [...fixture.genres],
    synopsis: fixture.synopsis ? fixture.synopsis[locale] : null,
    posterUrl: null,
    backdropUrl: null,
    art: fixture.art,
    director: null,
    actors: null,
    country: null,
    imdb_id: null,
    imdb_rating: null,
    website: null,
  };
}

export type HomeScenario = "default" | "empty" | "error";

const MOVIES_API_ORIGIN =
  (typeof process !== "undefined" && process.env.MOVIES_API_ORIGIN) ||
  "https://moviesapi.codingfront.dev";
const MOVIES_API_URL = `${MOVIES_API_ORIGIN}/api/v1/movies?page=1`;
const FETCH_TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 300;

export const APPLICATION_PAGE_SIZE = 15;

/** Maps internal genre keys to exact API genre names for the genre-movies endpoint. */
export const GENRE_KEY_TO_API_NAME: Record<GenreKey, string> = {
  action: "Action",
  adventure: "Adventure",
  animation: "Animation",
  biography: "Biography",
  comedy: "Comedy",
  crime: "Crime",
  documentary: "Documentary",
  drama: "Drama",
  family: "Family",
  fantasy: "Fantasy",
  filmNoir: "Film-Noir",
  history: "History",
  horror: "Horror",
  music: "Music",
  romance: "Romance",
  scifi: "Sci-Fi",
  sport: "Sport",
  thriller: "Thriller",
  war: "War",
  western: "Western",
};

/** Reverse lookup: maps lowercase API genre name to internal GenreKey. */
export const API_NAME_TO_GENRE_KEY: Record<string, GenreKey> = Object.entries(
  GENRE_KEY_TO_API_NAME,
).reduce((acc, [key, name]) => {
  acc[name.toLowerCase()] = key as GenreKey;
  return acc;
}, {} as Record<string, GenreKey>);

/** Selects 4 to 6 distinct movie candidates suitable for the Hero Carousel, ranked by rating. */
export function getHeroCandidates(movies: Movie[]): Movie[] {
  // Sort movies by rating descending (highest rating first)
  const sorted = [...movies].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const seen = new Set<string>();
  const candidates: Movie[] = [];

  // First pass: prefer movies with backdrops among highest rated
  for (const movie of sorted) {
    if (movie.backdropUrl && !seen.has(movie.id)) {
      seen.add(movie.id);
      candidates.push(movie);
      if (candidates.length === 6) return candidates;
    }
  }

  // Second pass: fill up to 6 candidates with remaining top-rated movies
  for (const movie of sorted) {
    if (!seen.has(movie.id)) {
      seen.add(movie.id);
      candidates.push(movie);
      if (candidates.length === 6) break;
    }
  }

  return candidates;
}

/** Pure Fisher-Yates shuffle to randomize candidate presentation order. */
export function shuffleCandidates<T>(items: readonly T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i]!;
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
}

/** Maps any casing or variant of a genre name to internal GenreKey. */
export function resolveGenreKey(genreName: string): GenreKey | undefined {
  const trimmed = genreName.trim();
  const lower = trimmed.toLowerCase();
  if (API_NAME_TO_GENRE_KEY[lower]) {
    return API_NAME_TO_GENRE_KEY[lower];
  }
  if ((GENRE_KEYS as readonly string[]).includes(lower)) {
    return lower as GenreKey;
  }
  if ((GENRE_KEYS as readonly string[]).includes(trimmed)) {
    return trimmed as GenreKey;
  }
  return undefined;
}

/** Pure pagination helper for in-memory lists (fixtures, test collections). */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = APPLICATION_PAGE_SIZE,
): {
  items: T[];
  metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
} {
  const num = Number(page);
  const safePage = Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (safePage - 1) * pageSize;
  const sliced = start < total ? items.slice(start, start + pageSize) : [];
  return {
    items: sliced,
    metadata: {
      current_page: String(safePage),
      per_page: String(pageSize),
      page_count: String(totalPages),
      total_count: String(total),
    },
  };
}

interface ApiResponse {
  data: unknown;
  metadata?: {
    current_page?: string | number;
    per_page?: string | number;
    page_count?: string | number;
    total_count?: string | number;
  };
}

async function fetchLiveMovies(): Promise<{
  movies: Movie[];
  isValidEnvelope: boolean;
  totalCount: number;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(MOVIES_API_URL, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error("Non-JSON response");
    }

    const data = await response.json();

    const apiResponse = data as ApiResponse;
    const totalCountValue = apiResponse.metadata!.total_count;
    const totalCountNum =
      totalCountValue !== undefined ? Number(totalCountValue) : NaN;
    const totalCountIsValid =
      typeof totalCountValue === "string" || typeof totalCountValue === "number";
    const hasValidEnvelope: boolean =
      apiResponse &&
      typeof apiResponse === "object" &&
      Array.isArray(apiResponse.data) &&
      apiResponse.metadata !== undefined &&
      typeof apiResponse.metadata === "object" &&
      totalCountIsValid &&
      Number.isFinite(totalCountNum);

    const totalCount = hasValidEnvelope ? totalCountNum : 0;
    const movies = normalizeMovieList(apiResponse.data);

    return { movies, isValidEnvelope: hasValidEnvelope, totalCount };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function buildHomeCatalogFromApi(movies: Movie[]): CatalogState<HomeCatalog> {
  const heroCandidates = getHeroCandidates(movies);
  const featured = heroCandidates[0] ?? movies[0];
  const picks = movies;

  const present = new Set<string>(movies.flatMap((movie) => movie.genres));
  const genres = GENRE_KEYS.filter((key): key is GenreKey => present.has(key));

  return {
    status: "success",
    source: "api",
    data: { featured, heroCandidates, picks, genres },
  };
}

function buildEmptyCatalogFromApi(): CatalogState<HomeCatalog> {
  return {
    status: "empty",
    source: "api",
  };
}

/**
 * Home catalog with live API primary, fixture fallback.
 * `scenario` exists so empty/error UI can be exercised in tests and previews.
 */
export async function getHomeCatalog(
  locale: CatalogLocale = "en",
  scenario: HomeScenario = "default",
): Promise<CatalogState<HomeCatalog>> {
  if (scenario === "error") return { status: "error", reason: "fixture-error-scenario" };
  if (scenario === "empty") return { status: "empty", source: "fixture" };

  try {
    const { movies, isValidEnvelope, totalCount } = await fetchLiveMovies();

    if (!isValidEnvelope) {
      throw new Error("Malformed response envelope");
    }

    // Inconsistent metadata: envelope says there are movies but data array is empty
    if (totalCount > 0 && movies.length === 0) {
      throw new Error("Inconsistent metadata: total_count > 0 but no movies");
    }

    if (movies.length === 0) {
      return buildEmptyCatalogFromApi();
    }

    return buildHomeCatalogFromApi(movies);
  } catch {
    // Fallback to fixtures on failure (network, HTTP, parsing, malformed envelope)
    const allFixtures = FIXTURE_MOVIES.map((movie) => fixtureToMovie(movie, locale));
    const heroCandidates = getHeroCandidates(allFixtures);
    const featured = heroCandidates[0] ?? allFixtures[0];
    const picks = allFixtures;

    const present = new Set<string>(FIXTURE_MOVIES.flatMap((movie) => movie.genres));
    const genres = GENRE_KEYS.filter((key): key is GenreKey => present.has(key));

    return {
      status: "success",
      source: "fixture",
      data: { featured, heroCandidates, picks, genres },
    };
  }
}

/**
 * Fetches a single movie directly from the detail endpoint:
 * GET /api/v1/movies/{id}
 *
 * Throws MovieNotFoundError when the API returns HTTP 404.
 * Throws on network errors, non-2xx responses, malformed JSON, etc.
 * Does NOT fall back to fixtures — callers decide how to handle failures.
 */
export async function getMovieByIdDirect(id: string): Promise<Movie> {
  const url = `${MOVIES_API_ORIGIN}/api/v1/movies/${encodeURIComponent(id)}`;

  const response = await fetch(url, {
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (response.status === 404) {
    throw new MovieNotFoundError();
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error("Non-JSON response");
  }

  const data = await response.json();
  const apiResponse = data as Record<string, unknown>;
  if (!apiResponse || typeof apiResponse !== "object") {
    throw new Error("Malformed response envelope");
  }

  const movie = normalizeMovie(apiResponse);
  if (!movie) {
    throw new Error("Malformed movie record");
  }

  return movie;
}

/** Internal helper to fetch a single raw page from the API. */
export async function fetchRawApiPage(
  url: string,
): Promise<{ movies: Movie[]; metadata: { current_page: number; per_page: number; page_count: number; total_count: number } }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      throw new MovieNotFoundError();
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error("Non-JSON response");
    }

    const data = await response.json();
    const apiResponse = data as ApiResponse;
    if (
      !apiResponse ||
      typeof apiResponse !== "object" ||
      !Array.isArray(apiResponse.data) ||
      !apiResponse.metadata ||
      typeof apiResponse.metadata !== "object"
    ) {
      throw new Error("Malformed response envelope");
    }

    const perPage = Number(apiResponse.metadata.per_page) || 12;
    const currentPage = Number(apiResponse.metadata.current_page) || 1;
    const pageCount = Number(apiResponse.metadata.page_count) || 1;
    const totalCount = Number(apiResponse.metadata.total_count) || 0;

    return {
      movies: normalizeMovieList(apiResponse.data),
      metadata: {
        current_page: currentPage,
        per_page: perPage,
        page_count: pageCount,
        total_count: totalCount,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

const apiMetadataCache = new Map<string, { perPage: number; totalCount: number }>();

export function clearApiMetadataCache(): void {
  apiMetadataCache.clear();
}

/**
 * Aggregates and slices raw API pages (e.g. 12 items/page) into logical 15-item application pages.
 * Preserves API ordering, eliminates duplicate movie IDs, and handles final partial pages correctly.
 */
export async function fetchPaginatedMoviesFromApi(
  baseUrl: string,
  logicalPage: number,
): Promise<{
  movies: Movie[];
  metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
  source: "api";
}> {
  const num = Number(logicalPage);
  const safePage = Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1;
  const targetSize = APPLICATION_PAGE_SIZE;
  const sep = baseUrl.includes("?") ? "&" : "?";

  // Discover actual per_page and total_count from a reliable metadata request
  const cachedMeta = apiMetadataCache.get(baseUrl);
  const initialApiPage = cachedMeta
    ? Math.floor(((safePage - 1) * targetSize) / cachedMeta.perPage) + 1
    : safePage;

  const firstRes = await fetchRawApiPage(`${baseUrl}${sep}page=${initialApiPage}`);
  const rawPerPage = Number(firstRes.metadata.per_page);
  const rawTotal = Number(firstRes.metadata.total_count);

  if (
    !Number.isInteger(rawPerPage) ||
    rawPerPage <= 0 ||
    !Number.isInteger(rawTotal) ||
    rawTotal < 0
  ) {
    throw new Error("Invalid pagination metadata");
  }

  const apiPerPage = rawPerPage;
  const totalCount = rawTotal;
  apiMetadataCache.set(baseUrl, { perPage: apiPerPage, totalCount });

  const logicalPageCount = Math.max(1, Math.ceil(totalCount / targetSize));

  // If the API natively returns 15 items per page, map directly without aggregation
  if (apiPerPage === targetSize) {
    const directRes =
      initialApiPage === safePage
        ? firstRes
        : await fetchRawApiPage(`${baseUrl}${sep}page=${safePage}`);

    const rawTotal = Number(directRes.metadata.total_count);
    const currentTotal = Number.isInteger(rawTotal) && rawTotal >= 0 ? rawTotal : totalCount;
    const startIndex = (safePage - 1) * targetSize;

    if (startIndex >= currentTotal || currentTotal === 0) {
      return {
        movies: [],
        metadata: {
          current_page: String(safePage),
          per_page: String(targetSize),
          page_count: String(Math.max(1, Math.ceil(currentTotal / targetSize))),
          total_count: String(currentTotal),
        },
        source: "api",
      };
    }

    // Deduplicate in encounter order
    const seen = new Set<string>();
    let hadDuplicates = false;
    const movies: Movie[] = [];
    for (const m of directRes.movies) {
      if (seen.has(m.id)) {
        hadDuplicates = true;
      } else {
        seen.add(m.id);
        movies.push(m);
      }
    }

    const expectedCount = Math.min(targetSize, Math.max(0, currentTotal - startIndex));
    if (hadDuplicates && movies.length < expectedCount) {
      throw new Error(
        `Inconsistent upstream records: expected ${expectedCount} unique movies, received ${movies.length}`,
      );
    }

    return {
      movies,
      metadata: {
        current_page: String(safePage),
        per_page: String(targetSize),
        page_count: String(Math.max(1, Math.ceil(currentTotal / targetSize))),
        total_count: String(currentTotal),
      },
      source: "api",
    };
  }

  // Multi-API-page aggregation for logical 15-item application pages
  const startIndex = (safePage - 1) * targetSize;
  const endIndex = startIndex + targetSize - 1;

  if (startIndex >= totalCount || totalCount === 0) {
    return {
      movies: [],
      metadata: {
        current_page: String(safePage),
        per_page: String(targetSize),
        page_count: String(logicalPageCount),
        total_count: String(totalCount),
      },
      source: "api",
    };
  }

  const pStart = Math.floor(startIndex / apiPerPage) + 1;
  const pEnd = Math.floor(endIndex / apiPerPage) + 1;
  const maxApiPage = Math.max(1, Math.ceil(totalCount / apiPerPage));
  const clampedEnd = Math.min(pEnd, maxApiPage);

  const neededPages: number[] = [];
  for (let p = pStart; p <= clampedEnd; p++) {
    neededPages.push(p);
  }

  const responses = await Promise.all(
    neededPages.map((p) => {
      if (p === initialApiPage) return Promise.resolve(firstRes);
      return fetchRawApiPage(`${baseUrl}${sep}page=${p}`);
    }),
  );

  const allMovies: Movie[] = [];
  for (const res of responses) {
    allMovies.push(...res.movies);
  }

  // Deduplicate all movies collected so far in encounter order
  const seen = new Set<string>();
  let hadDuplicates = false;
  const uniqueMovies: Movie[] = [];
  for (const m of allMovies) {
    if (seen.has(m.id)) {
      hadDuplicates = true;
    } else {
      seen.add(m.id);
      uniqueMovies.push(m);
    }
  }

  const offset = (pStart - 1) * apiPerPage;
  const sliceStart = Math.max(0, startIndex - offset);

  // If duplicates across API pages resulted in fewer unique items than needed,
  // fetch subsequent API pages to satisfy the logical page if more pages exist
  let currentEnd = clampedEnd;
  while (uniqueMovies.length < sliceStart + targetSize && currentEnd < maxApiPage) {
    currentEnd++;
    const nextRes = await fetchRawApiPage(`${baseUrl}${sep}page=${currentEnd}`);
    for (const m of nextRes.movies) {
      if (seen.has(m.id)) {
        hadDuplicates = true;
      } else {
        seen.add(m.id);
        uniqueMovies.push(m);
      }
    }
  }

  const movies = uniqueMovies.slice(sliceStart, sliceStart + targetSize);
  const expectedCount = Math.min(targetSize, Math.max(0, totalCount - startIndex));

  if (hadDuplicates && movies.length < expectedCount) {
    throw new Error(
      `Inconsistent upstream records: expected ${expectedCount} unique movies, received ${movies.length}`,
    );
  }

  return {
    movies,
    metadata: {
      current_page: String(safePage),
      per_page: String(targetSize),
      page_count: String(logicalPageCount),
      total_count: String(totalCount),
    },
    source: "api",
  };
}

/**
 * Fetches a logical 15-movie page from the list endpoint:
 * GET /api/v1/movies?page={page}
 *
 * Uses multi-page aggregation when the API returns 12-item pages.
 * Falls back to fixture pagination in the requested locale on failure.
 */
export async function getMoviesByPage(
  page: number = 1,
  locale: CatalogLocale = "en",
): Promise<{
  movies: Movie[];
  metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
  source: "api" | "fixture";
}> {
  try {
    return await fetchPaginatedMoviesFromApi(`${MOVIES_API_ORIGIN}/api/v1/movies`, page);
  } catch {
    const safePage = Math.max(1, page);
    const fixtures = FIXTURE_MOVIES.map((movie) => fixtureToMovie(movie, locale));
    const paginated = paginateItems(fixtures, safePage, APPLICATION_PAGE_SIZE);
    return {
      movies: paginated.items,
      metadata: paginated.metadata,
      source: "fixture",
    };
  }
}

/**
 * Fetches a logical 15-movie page of a specific genre from the genre endpoint:
 * GET /api/v1/genres/{genreName}/movies?page={page}
 *
 * Uses multi-page aggregation when the API returns 12-item pages.
 * Throws MovieNotFoundError when the API returns HTTP 404 or for unknown genres.
 * Falls back to genre-filtered fixtures in the requested locale on network failure, 5xx, or malformed data.
 */
export async function getMoviesByGenre(
  genreName: string,
  page: number = 1,
  locale: CatalogLocale = "en",
): Promise<{
  movies: Movie[];
  metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
  source: "api" | "fixture";
}> {
  const genreKey = resolveGenreKey(genreName);
  if (!genreKey) {
    throw new MovieNotFoundError();
  }

  const apiGenreName = GENRE_KEY_TO_API_NAME[genreKey] ?? genreName;
  const encodedGenre = encodeURIComponent(apiGenreName);

  try {
    return await fetchPaginatedMoviesFromApi(
      `${MOVIES_API_ORIGIN}/api/v1/genres/${encodedGenre}/movies`,
      page,
    );
  } catch (error) {
    if (error instanceof MovieNotFoundError) {
      throw error;
    }

    // On network errors, timeouts, HTTP 5xx, malformed responses, or invalid API metadata,
    // return fixture movies filtered to that genre in the requested locale.
    const safePage = Math.max(1, page);
    const matchingFixtures = FIXTURE_MOVIES.filter((m) => m.genres.includes(genreKey));
    const localized = matchingFixtures.map((m) => fixtureToMovie(m, locale));
    const paginated = paginateItems(localized, safePage, APPLICATION_PAGE_SIZE);

    return {
      movies: paginated.items,
      metadata: paginated.metadata,
      source: "fixture",
    };
  }
}

/** Backward-compatible wrapper: fetches the detail endpoint for a movie id. */
export async function getMovieById(id: string): Promise<Movie | null> {
  try {
    return await getMovieByIdDirect(id);
  } catch {
    return null;
  }
}

/**
 * Fetches page 1 of the live movie catalog and returns all normalized movies.
 * Falls back to all fixture movies on any failure.
 */
export async function getAllMovies(locale: CatalogLocale): Promise<Movie[]> {
  try {
    const response = await fetch(MOVIES_API_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) throw new Error("Non-JSON response");

    const data = await response.json();
    const apiResponse = data as ApiResponse;
    if (
      !apiResponse ||
      typeof apiResponse !== "object" ||
      !Array.isArray(apiResponse.data)
    ) {
      throw new Error("Malformed response envelope");
    }

    return normalizeMovieList(apiResponse.data);
  } catch {
    return FIXTURE_MOVIES.map((movie) => fixtureToMovie(movie, locale));
  }
}
