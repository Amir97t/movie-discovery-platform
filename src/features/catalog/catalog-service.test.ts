import { describe, expect, it } from "vitest";
import { FIXTURE_MOVIES } from "./catalog-fixtures";
import { getHomeCatalog } from "./catalog-service";

describe("fixtures", () => {
  it("have unique ids and non-empty titles in both locales", () => {
    const ids = new Set(FIXTURE_MOVIES.map((movie) => movie.id));
    expect(ids.size).toBe(FIXTURE_MOVIES.length);
    for (const movie of FIXTURE_MOVIES) {
      expect(movie.title.en.trim()).not.toBe("");
      expect(movie.title.fa.trim()).not.toBe("");
    }
  });

  it("deliberately include incomplete and extreme records", () => {
    expect(FIXTURE_MOVIES.some((m) => m.rating === null)).toBe(true);
    expect(FIXTURE_MOVIES.some((m) => m.genres.length === 0 && m.year === null)).toBe(true);
    expect(FIXTURE_MOVIES.some((m) => m.title.en.length > 60)).toBe(true);
  });
});

describe("getHomeCatalog", () => {
  it("returns a featured movie, picks without it, and used genres, per locale", () => {
    for (const locale of ["en", "fa"] as const) {
      const state = getHomeCatalog(locale);
      expect(state.status).toBe("success");
      if (state.status !== "success") return;
      expect(state.source).toBe("fixture");
      expect(state.data.picks.some((m) => m.id === state.data.featured.id)).toBe(false);
      expect(state.data.picks.length).toBe(FIXTURE_MOVIES.length - 1);
      expect(state.data.genres.length).toBeGreaterThan(0);
      expect(state.data.featured.title).toBe(
        FIXTURE_MOVIES.find((m) => m.id === state.data.featured.id)?.title[locale],
      );
    }
  });

  it("supports empty and error scenarios for UI states", () => {
    expect(getHomeCatalog("en", "empty")).toEqual({ status: "empty" });
    expect(getHomeCatalog("fa", "error").status).toBe("error");
  });
});
