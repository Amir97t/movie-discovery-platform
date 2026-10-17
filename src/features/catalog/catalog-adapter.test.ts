import { describe, expect, it } from "vitest";
import { normalizeImageUrl, normalizeMovie, normalizeMovieList } from "./catalog-adapter";

const image = (name: string) => `https://moviesapi.codingfront.dev/images/${name}`;

describe("normalizeImageUrl", () => {
  it("keeps documented absolute HTTPS URLs on the API image host", () => {
    expect(normalizeImageUrl(image("tt0111161.jpg"))).toBe(image("tt0111161.jpg"));
  });

  it("resolves a bare poster filename against /images/", () => {
    expect(normalizeImageUrl("tt0111161_poster.jpg")).toBe(image("tt0111161_poster.jpg"));
  });

  it("resolves root-relative image paths", () => {
    expect(normalizeImageUrl("/images/tt0111161_backdrop.jpg")).toBe(image("tt0111161_backdrop.jpg"));
  });

  it("rejects unexpected hosts, insecure URLs and empty values", () => {
    expect(normalizeImageUrl("https://external.example/poster.jpg")).toBeNull();
    expect(normalizeImageUrl("http://moviesapi.codingfront.dev/images/poster.jpg")).toBeNull();
    expect(normalizeImageUrl("https://moviesapi.codingfront.dev/api/v1/movies/1")).toBeNull();
    expect(normalizeImageUrl("../outside.jpg")).toBeNull();
    expect(normalizeImageUrl(" ")).toBeNull();
    expect(normalizeImageUrl(null)).toBeNull();
  });
});

describe("normalizeMovie (documentation-derived shapes)", () => {
  it("maps a complete detail record including separate poster and backdrop", () => {
    expect(
      normalizeMovie({
        id: 1,
        title: " The Shawshank Redemption ",
        imdb_rating: "9.3",
        released: "14 Oct 1994",
        runtime: "142 min",
        genres: ["Crime", "Drama"],
        plot: "A plot.",
        poster: "tt0111161_poster.jpg",
        images: [image("tt0111161_backdrop.jpg")],
      }),
    ).toMatchObject({
      id: "1",
      title: "The Shawshank Redemption",
      rating: 9.3,
      year: 1994,
      runtimeMinutes: 142,
      genres: ["Crime", "Drama"],
      synopsis: "A plot.",
      posterUrl: image("tt0111161_poster.jpg"),
      backdropUrl: image("tt0111161_backdrop.jpg"),
      art: null,
    });
  });

  it("supports summary records with full poster URLs and missing optional fields", () => {
    const movie = normalizeMovie({
      id: "2",
      title: "The Godfather",
      poster: image("tt0068646.jpg"),
      genres: ["Crime", null, "Drama"],
      images: [image("tt0068646_backdrop.jpg")],
    });

    expect(movie).toMatchObject({
      id: "2",
      title: "The Godfather",
      rating: null,
      year: null,
      runtimeMinutes: null,
      genres: ["Crime", "Drama"],
      synopsis: null,
      posterUrl: image("tt0068646.jpg"),
      backdropUrl: image("tt0068646_backdrop.jpg"),
    });
  });

  it("does not use a wide backdrop as a portrait poster when the poster is absent", () => {
    const movie = normalizeMovie({
      id: 3,
      title: "Sparse",
      images: [image("wide.jpg")],
    });
    expect(movie?.posterUrl).toBeNull();
    expect(movie?.backdropUrl).toBe(image("wide.jpg"));
  });

  it("rejects records without usable IDs/titles and out-of-range ratings", () => {
    expect(normalizeMovie(null)).toBeNull();
    expect(normalizeMovie([])).toBeNull();
    expect(normalizeMovie({ title: "No id" })).toBeNull();
    expect(normalizeMovie({ id: 1, title: "   " })).toBeNull();
    expect(normalizeMovie({ id: 1, title: "X", imdb_rating: 99 })?.rating).toBeNull();
    expect(normalizeMovie({ id: 1, title: "X", imdb_rating: null })?.rating).toBeNull();
  });
});

describe("normalizeMovieList", () => {
  it("accepts a bare array or documented { data: [] } envelope", () => {
    const good = { id: 1, title: "A", poster: image("a.jpg") };
    expect(normalizeMovieList([good, { nope: true }])).toHaveLength(1);
    expect(normalizeMovieList({ data: [good, good] })).toHaveLength(2);
    expect(normalizeMovieList({ data: "not a list" })).toEqual([]);
    expect(normalizeMovieList(undefined)).toEqual([]);
  });
});
