import { FEATURED_FIXTURE_ID, FIXTURE_MOVIES, type FixtureMovie } from "./catalog-fixtures";
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
  const featured = movies[0];
  const picks = movies.slice(1);

  const present = new Set<string>(movies.flatMap((movie) => movie.genres));
  const genres = GENRE_KEYS.filter((key): key is GenreKey => present.has(key));

  return {
    status: "success",
    source: "api",
    data: { featured, picks, genres },
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
  locale: CatalogLocale,
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
    const featuredFixture =
      FIXTURE_MOVIES.find((movie) => movie.id === FEATURED_FIXTURE_ID) ?? FIXTURE_MOVIES[0];
    if (!featuredFixture) return { status: "empty", source: "fixture" };

    const picks = FIXTURE_MOVIES.filter((movie) => movie.id !== featuredFixture.id).map((movie) =>
      fixtureToMovie(movie, locale),
    );

    const present = new Set<string>(FIXTURE_MOVIES.flatMap((movie) => movie.genres));
    const genres = GENRE_KEYS.filter((key): key is GenreKey => present.has(key));

    return {
      status: "success",
      source: "fixture",
      data: { featured: fixtureToMovie(featuredFixture, locale), picks, genres },
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

/**
 * Fetches a page of movies from the list endpoint:
 * GET /api/v1/movies?page={page}
 *
 * Returns normalized movies and pagination metadata.
 * Falls back to fixtures on any failure.
 */
export async function getMoviesByPage(page: number): Promise<{
  movies: Movie[];
  metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
}> {
  try {
    const response = await fetch(`${MOVIES_API_ORIGIN}/api/v1/movies?page=${page}`, {
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
      !Array.isArray(apiResponse.data) ||
      !apiResponse.metadata ||
      typeof apiResponse.metadata !== "object"
    ) {
      throw new Error("Malformed response envelope");
    }

    return {
      movies: normalizeMovieList(apiResponse.data),
      metadata: {
        current_page: String(apiResponse.metadata.current_page ?? "1"),
        per_page: String(apiResponse.metadata.per_page ?? "12"),
        page_count: String(apiResponse.metadata.page_count ?? "1"),
        total_count: String(apiResponse.metadata.total_count ?? "0"),
      },
    };
  } catch {
    const movies = FIXTURE_MOVIES.map((movie) => fixtureToMovie(movie, "en"));
    return {
      movies,
      metadata: { current_page: "1", per_page: "12", page_count: "1", total_count: String(movies.length) },
    };
  }
}

/**
 * Fetches movies of a specific genre from the genre endpoint:
 * GET /api/v1/genres/{genreName}/movies?page={page}
 *
 * `genreName` must be the exact API genre name (e.g. "Crime", "Drama"),
 * not the internal key. Throws MovieNotFoundError on HTTP 404.
 * Falls back to fixtures on other failures.
 */
export async function getMoviesByGenre(genreName: string, page: number): Promise<{
  movies: Movie[];
  metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
}> {
  try {
    const encodedGenre = encodeURIComponent(genreName);
    const url = `${MOVIES_API_ORIGIN}/api/v1/genres/${encodedGenre}/movies?page=${page}`;

    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.status === 404) {
      throw new MovieNotFoundError();
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) throw new Error("Non-JSON response");

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

    return {
      movies: normalizeMovieList(apiResponse.data),
      metadata: {
        current_page: String(apiResponse.metadata.current_page ?? "1"),
        per_page: String(apiResponse.metadata.per_page ?? "12"),
        page_count: String(apiResponse.metadata.page_count ?? "1"),
        total_count: String(apiResponse.metadata.total_count ?? "0"),
      },
    };
  } catch (err) {
    throw err;
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
