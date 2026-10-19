import { FEATURED_FIXTURE_ID, FIXTURE_MOVIES, type FixtureMovie } from "./catalog-fixtures";
import { normalizeMovieList } from "./catalog-adapter";
import {
  GENRE_KEYS,
  type CatalogLocale,
  type CatalogState,
  type GenreKey,
  type HomeCatalog,
  type Movie,
} from "./catalog-types";

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
  };
}

export type HomeScenario = "default" | "empty" | "error";

const MOVIES_API_ORIGIN = "https://moviesapi.codingfront.dev";
const MOVIES_API_URL = `${MOVIES_API_ORIGIN}/api/v1/movies?page=1`;
const FETCH_TIMEOUT_MS = 8000;
const REVALIDATE_SECONDS = 300;

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

    // Validate response envelope structure
    const apiResponse = data as ApiResponse;
    const hasValidEnvelope: boolean =
      apiResponse &&
      typeof apiResponse === "object" &&
      Array.isArray(apiResponse.data) &&
      apiResponse.metadata !== undefined &&
      typeof apiResponse.metadata === "object" &&
      typeof apiResponse.metadata.total_count === "number";

    const totalCount = hasValidEnvelope ? (apiResponse.metadata!.total_count as number) : 0;
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
