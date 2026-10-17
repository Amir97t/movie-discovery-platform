import { FEATURED_FIXTURE_ID, FIXTURE_MOVIES, type FixtureMovie } from "./catalog-fixtures";
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

/**
 * Home catalog from local fixtures. The live API is intentionally not wired
 * in: its response contract is unverified (docs/API_RECONNAISSANCE.md).
 * `scenario` exists so empty/error UI can be exercised in tests and previews.
 */
export function getHomeCatalog(
  locale: CatalogLocale,
  scenario: HomeScenario = "default",
): CatalogState<HomeCatalog> {
  if (scenario === "error") return { status: "error", reason: "fixture-error-scenario" };
  if (scenario === "empty") return { status: "empty" };

  const featuredFixture =
    FIXTURE_MOVIES.find((movie) => movie.id === FEATURED_FIXTURE_ID) ?? FIXTURE_MOVIES[0];
  if (!featuredFixture) return { status: "empty" };

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
