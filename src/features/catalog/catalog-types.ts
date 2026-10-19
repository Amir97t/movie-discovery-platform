export const GENRE_KEYS = [
  "action",
  "adventure",
  "animation",
  "biography",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "filmNoir",
  "history",
  "horror",
  "music",
  "romance",
  "scifi",
  "sport",
  "thriller",
  "war",
  "western",
] as const;

export type GenreKey = (typeof GENRE_KEYS)[number];

export type CatalogLocale = "en" | "fa";

/** App-internal movie model. Every field except id/title may be missing. */
export interface Movie {
  id: string;
  title: string;
  year: number | null;
  /** 0–10 scale; null when unknown. */
  rating: number | null;
  runtimeMinutes: number | null;
  /** Fixture genres are GenreKey values; API genres are raw strings. */
  genres: string[];
  synopsis: string | null;
  posterUrl: string | null;
  /** First wide image from the API, commonly used as a backdrop. */
  backdropUrl: string | null;
  /** Placeholder artwork gradient (fixtures only). */
  art: readonly [string, string] | null;
}

export type CatalogState<T> =
  | { status: "success"; data: T; source: "fixture" | "api" }
  | { status: "empty"; source: "fixture" | "api" }
  | { status: "error"; reason: string };

export interface HomeCatalog {
  featured: Movie;
  picks: Movie[];
  genres: GenreKey[];
}
