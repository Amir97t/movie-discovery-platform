import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FIXTURE_MOVIES } from "./catalog-fixtures";
import {
  GENRE_KEY_TO_API_NAME,
  getAllMovies,
  getHomeCatalog,
  getMovieById,
  getMovieByIdDirect,
  getMoviesByGenre,
  getMoviesByPage,
  MovieNotFoundError,
} from "./catalog-service";
import type { CatalogState } from "./catalog-types";

const mockMovie = {
  id: 1,
  title: "Test Movie",
  poster: "tt0111161_poster.jpg",
  imdb_rating: "8.5",
  released: "2020-01-01",
  runtime: "120 min",
  genres: ["Action", "Drama"],
  plot: "A test movie plot.",
  images: ["tt0111161_backdrop.jpg"],
};

function createMockResponse(data: unknown, metadata?: Record<string, unknown>): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    redirected: false,
    type: "basic",
    url: "",
    json: vi.fn().mockResolvedValue({ data, metadata }),
    clone: vi.fn(),
    blob: vi.fn(),
    text: vi.fn(),
    arrayBuffer: vi.fn(),
    formData: vi.fn(),
    body: null,
    bodyUsed: false,
  } as unknown as Response;
}

function createMockMovieResponse(movie: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    redirected: false,
    type: "basic",
    url: "",
    json: vi.fn().mockResolvedValue(movie),
    clone: vi.fn(),
    blob: vi.fn(),
    text: vi.fn(),
    arrayBuffer: vi.fn(),
    formData: vi.fn(),
    body: null,
    bodyUsed: false,
  } as unknown as Response;
}

function createMockErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    statusText: status === 404 ? "Not Found" : "Internal Server Error",
    headers: new Headers({ "content-type": "application/json" }),
    redirected: false,
    type: "basic",
    url: "",
    json: vi.fn().mockResolvedValue({ error: "Not found" }),
    clone: vi.fn(),
    blob: vi.fn(),
    text: vi.fn(),
    arrayBuffer: vi.fn(),
    formData: vi.fn(),
    body: null,
    bodyUsed: false,
  } as unknown as Response;
}

function isSuccessState<T>(state: CatalogState<T>): state is { status: "success"; data: T; source: "fixture" | "api" } {
  return state.status === "success";
}

function isEmptyState<T>(state: CatalogState<T>): state is { status: "empty"; source: "fixture" | "api" } {
  return state.status === "empty";
}

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns a featured movie, picks without it, and used genres, per locale", async () => {
    for (const locale of ["en", "fa"] as const) {
      const state = await getHomeCatalog(locale);
      expect(state.status).toBe("success");
      if (!isSuccessState(state)) return;
      expect(["fixture", "api"]).toContain(state.source);
      expect(state.data.picks.some((m) => m.id === state.data.featured.id)).toBe(false);
      expect(state.data.picks.length).toBeGreaterThan(0);
      expect(state.data.genres.length).toBeGreaterThan(0);
    }
  });

  it("supports empty and error scenarios for UI states", async () => {
    expect(await getHomeCatalog("en", "empty")).toEqual({ status: "empty", source: "fixture" });
    expect((await getHomeCatalog("fa", "error")).status).toBe("error");
  });

  describe("API behavior with mocked fetch", () => {
    it("successful API response with valid envelope returns normalized movies with source: api", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], { current_page: 1, per_page: 12, page_count: 1, total_count: 1 })
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("api");
      expect(isSuccessState(state) && state.data.featured.title).toBe("Test Movie");
      expect(isSuccessState(state) && state.data.featured.genres).toContain("action");
      expect(isSuccessState(state) && state.data.featured.genres).toContain("drama");
      expect(isSuccessState(state) && state.data.featured.synopsis).toBe("A test movie plot.");
      expect(isSuccessState(state) && state.data.picks.length).toBe(0);
    });

    it("valid empty response with data: [] and total_count: 0 returns API-backed empty state", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([], { current_page: 1, per_page: 12, page_count: 0, total_count: 0 })
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("empty");
      expect(isEmptyState(state) && state.source).toBe("api");
    });

    it("empty data with inconsistent metadata (total_count > 0) falls back to fixtures", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([], { current_page: 1, per_page: 12, page_count: 0, total_count: 5 })
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("missing metadata triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], undefined)
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("invalid metadata (non-object) triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], { total_count: "not-a-number" } as Record<string, unknown>)
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("malformed envelope (non-array data) triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        redirected: false,
        type: "basic",
        url: "",
        json: vi.fn().mockResolvedValue({ data: "not-an-array" }),
        clone: vi.fn(),
        blob: vi.fn(),
        text: vi.fn(),
        arrayBuffer: vi.fn(),
        formData: vi.fn(),
        body: null,
        bodyUsed: false,
      } as unknown as Response);

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("non-2xx HTTP response triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(createMockErrorResponse(500));

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("404 HTTP response triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("invalid JSON response triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        redirected: false,
        type: "basic",
        url: "",
        json: vi.fn().mockRejectedValue(new Error("Unexpected token")),
        clone: vi.fn(),
        blob: vi.fn(),
        text: vi.fn(),
        arrayBuffer: vi.fn(),
        formData: vi.fn(),
        body: null,
        bodyUsed: false,
      } as unknown as Response);

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("network error triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("timeout (AbortError) triggers fixture fallback", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("fixture");
    });

    it("fixture fallback reports source: fixture and content is identifiable as sample data", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const state = await getHomeCatalog("en");

      expect(isSuccessState(state) && state.source).toBe("fixture");
      if (isSuccessState(state)) {
        expect(state.data.featured.art).not.toBeNull();
        expect(state.data.picks.some((m) => m.art !== null)).toBe(true);
      }
    });

    it("unknown API genres do not throw translation errors and are filtered silently", async () => {
      const movieWithUnknownGenre = {
        ...mockMovie,
        genres: ["Action", "UnknownGenre", "Drama"],
      };

      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([movieWithUnknownGenre], { current_page: 1, per_page: 12, page_count: 1, total_count: 1 })
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("api");
      expect(isSuccessState(state) && state.data.featured.genres).toContain("action");
      expect(isSuccessState(state) && state.data.featured.genres).toContain("drama");
      expect(isSuccessState(state) && state.data.featured.genres).not.toContain("UnknownGenre");
      expect(isSuccessState(state) && state.data.featured.genres).not.toContain("unknownGenre");
    });

    it("Persian locale does not display English synopsis as Persian prose for API movies", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], { current_page: 1, per_page: 12, page_count: 1, total_count: 1 })
      );

      const state = await getHomeCatalog("fa");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("api");
      expect(isSuccessState(state) && state.data.featured.synopsis).toBe("A test movie plot.");
    });

    it("valid API response with string total_count metadata returns API-sourced catalog", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], { current_page: "1", per_page: "12", page_count: "1", total_count: "250" })
      );

      const state = await getHomeCatalog("en");

      expect(state.status).toBe("success");
      expect(isSuccessState(state) && state.source).toBe("api");
      expect(isSuccessState(state) && state.data.featured.title).toBe("Test Movie");
    });
  });
});

describe("getMovieById", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the movie with the matching id from a valid API response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockMovieResponse(mockMovie));

    const movie = await getMovieById("1");
    expect(movie).not.toBeNull();
    expect(movie?.id).toBe("1");
    expect(movie?.title).toBe("Test Movie");

    const fetchMock2 = vi.mocked(fetch);
    fetchMock2.mockResolvedValueOnce(createMockMovieResponse({ ...mockMovie, id: 2, title: "Second Movie" }));

    const movie2 = await getMovieById("2");
    expect(movie2).not.toBeNull();
    expect(movie2?.id).toBe("2");
    expect(movie2?.title).toBe("Second Movie");
  });

  it("returns null when no movie matches the id", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([mockMovie], { current_page: 1, per_page: 12, page_count: 1, total_count: 1 })
    );

    const movie = await getMovieById("999");
    expect(movie).toBeNull();
  });

  it("returns null on network error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const movie = await getMovieById("1");
    expect(movie).toBeNull();
  });

  it("returns null on non-2xx HTTP response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(500));

    const movie = await getMovieById("1");
    expect(movie).toBeNull();
  });

  it("returns null on malformed envelope", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      redirected: false,
      type: "basic",
      url: "",
      json: vi.fn().mockResolvedValue({ data: "not-an-array" }),
      clone: vi.fn(),
      blob: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn(),
      formData: vi.fn(),
      body: null,
      bodyUsed: false,
    } as unknown as Response);

    const movie = await getMovieById("1");
    expect(movie).toBeNull();
  });
});

describe("getAllMovies", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns all normalized movies from a valid API response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([mockMovie, { ...mockMovie, id: 2, title: "Second Movie" }], {
        current_page: 1,
        per_page: 12,
        page_count: 1,
        total_count: 2,
      })
    );

    const movies = await getAllMovies("en");
    expect(movies).toHaveLength(2);
    expect(movies[0].id).toBe("1");
    expect(movies[1].id).toBe("2");
    expect(movies[0].title).toBe("Test Movie");
    expect(movies[1].title).toBe("Second Movie");
  });

  it("falls back to fixtures on network error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const movies = await getAllMovies("en");
    expect(movies.length).toBe(FIXTURE_MOVIES.length);
    expect(movies[0].title).toBe(FIXTURE_MOVIES[0].title.en);
  });

  it("falls back to fixtures on malformed envelope", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      redirected: false,
      type: "basic",
      url: "",
      json: vi.fn().mockResolvedValue({ data: "not-an-array" }),
      clone: vi.fn(),
      blob: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn(),
      formData: vi.fn(),
      body: null,
      bodyUsed: false,
    } as unknown as Response);

    const movies = await getAllMovies("en");
    expect(movies.length).toBe(FIXTURE_MOVIES.length);
  });

  it("returns localized titles for fixtures fallback", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const enMovies = await getAllMovies("en");
    const faMovies = await getAllMovies("fa");

    expect(enMovies[0].title).toBe(FIXTURE_MOVIES[0].title.en);
    expect(faMovies[0].title).toBe(FIXTURE_MOVIES[0].title.fa);
    expect(enMovies[0].title).not.toBe(faMovies[0].title);
  });
});

describe("getMovieByIdDirect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches the direct detail endpoint for a requested ID", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockMovieResponse(mockMovie));

    const movie = await getMovieByIdDirect("1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://moviesapi.codingfront.dev/api/v1/movies/1",
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
    expect(movie.id).toBe("1");
    expect(movie.title).toBe("Test Movie");
  });

  it("renders a movie outside page 1 via direct lookup", async () => {
    const fetchMock = vi.mocked(fetch);
    // Simulate movie with id=250 (on page 21, not page 1)
    const movieOutsidePage1 = { ...mockMovie, id: 250, title: "Movie on Page 21" };
    fetchMock.mockResolvedValueOnce(createMockMovieResponse(movieOutsidePage1));

    const movie = await getMovieByIdDirect("250");

    expect(movie).not.toBeNull();
    expect(movie.id).toBe("250");
    expect(movie.title).toBe("Movie on Page 21");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://moviesapi.codingfront.dev/api/v1/movies/250",
      expect.anything(),
    );
  });

  it("HTTP 404 differs from network failures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    await expect(getMovieByIdDirect("999")).rejects.toBeInstanceOf(MovieNotFoundError);

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getMovieByIdDirect("1")).rejects.toThrow(TypeError);
  });

  it("HTTP 404 differs from invalid JSON responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    await expect(getMovieByIdDirect("999")).rejects.toBeInstanceOf(MovieNotFoundError);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
      redirected: false,
      type: "basic",
      url: "",
      json: vi.fn().mockRejectedValue(new Error("Unexpected token")),
      clone: vi.fn(),
      blob: vi.fn(),
      text: vi.fn(),
      arrayBuffer: vi.fn(),
      formData: vi.fn(),
      body: null,
      bodyUsed: false,
    } as unknown as Response);

    await expect(getMovieByIdDirect("1")).rejects.toThrow(Error);
  });

  it("HTTP 404 differs from server errors (5xx)", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    await expect(getMovieByIdDirect("999")).rejects.toBeInstanceOf(MovieNotFoundError);

    fetchMock.mockResolvedValueOnce(createMockErrorResponse(500));
    await expect(getMovieByIdDirect("1")).rejects.toThrow(Error);
  });

  it("normalizes API fields from direct detail response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockMovieResponse(mockMovie));

    const movie = await getMovieByIdDirect("1");

    expect(movie.id).toBe("1");
    expect(movie.title).toBe("Test Movie");
    expect(movie.year).toBe(2020);
    expect(movie.rating).toBe(8.5);
    expect(movie.runtimeMinutes).toBe(120);
    expect(movie.genres).toContain("action");
    expect(movie.genres).toContain("drama");
    expect(movie.synopsis).toBe("A test movie plot.");
  });
});

describe("getMoviesByPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches the movie-list endpoint with the requested page", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([mockMovie], { current_page: "3", per_page: "12", page_count: "21", total_count: "250" }),
    );

    const result = await getMoviesByPage(3);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://moviesapi.codingfront.dev/api/v1/movies?page=3",
      expect.anything(),
    );
    expect(result.movies).toHaveLength(1);
    expect(result.metadata.current_page).toBe("3");
    expect(result.metadata.total_count).toBe("250");
  });

  it("invalid page parameters default to page 1", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([mockMovie], { current_page: "1", per_page: "12", page_count: "1", total_count: "1" }),
    );

    const result = await getMoviesByPage(0);
    expect(result.metadata.current_page).toBe("1");

    const result2 = await getMoviesByPage(-5);
    expect(result2.metadata.current_page).toBe("1");

    const result3 = await getMoviesByPage("abc" as unknown as number);
    expect(result3.metadata.current_page).toBe("1");
  });
});

describe("getMoviesByGenre", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the exact API genre name and URL-encodes it", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([mockMovie], { current_page: "1", per_page: "12", page_count: "9", total_count: "51" }),
    );

    const result = await getMoviesByGenre("Crime", 1);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://moviesapi.codingfront.dev/api/v1/genres/Crime/movies?page=1",
      expect.anything(),
    );
    expect(result.movies).toHaveLength(1);
    expect(result.metadata.total_count).toBe("51");
  });

  it("genre pagination consumes returned metadata", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse(
        [mockMovie, { ...mockMovie, id: 2, title: "Second Crime Movie" }],
        { current_page: "2", per_page: "12", page_count: "5", total_count: "51" },
      ),
    );

    const result = await getMoviesByGenre("Crime", 2);

    expect(result.metadata.current_page).toBe("2");
    expect(result.metadata.page_count).toBe("5");
    expect(result.metadata.total_count).toBe("51");
    expect(result.movies).toHaveLength(2);
  });

  it("unknown genre keys fail safely", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    await expect(getMoviesByGenre("NonExistentGenre", 1)).rejects.toBeInstanceOf(
      MovieNotFoundError,
    );
  });

  it("maps internal genre keys to API names", () => {
    expect(GENRE_KEY_TO_API_NAME["action"]).toBe("Action");
    expect(GENRE_KEY_TO_API_NAME["crime"]).toBe("Crime");
    expect(GENRE_KEY_TO_API_NAME["scifi"]).toBe("Sci-Fi");
    expect(GENRE_KEY_TO_API_NAME["filmNoir"]).toBe("Film-Noir");
    expect(GENRE_KEY_TO_API_NAME["western"]).toBe("Western");
  });

  it("genre names with special characters are URL-encoded", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([mockMovie], { current_page: "1", per_page: "12", page_count: "1", total_count: "1" }),
    );

    await getMoviesByGenre("Sci-Fi", 1);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://moviesapi.codingfront.dev/api/v1/genres/Sci-Fi/movies?page=1",
      expect.anything(),
    );
  });

  it("valid genre name with HTTP 404 throws MovieNotFoundError", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    await expect(getMoviesByGenre("Crime", 1)).rejects.toBeInstanceOf(MovieNotFoundError);
  });

  it("valid genre name with network error throws TypeError", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(getMoviesByGenre("Crime", 1)).rejects.toThrow(TypeError);
  });

  it("valid genre name with 5xx server error throws Error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(500));

    await expect(getMoviesByGenre("Crime", 1)).rejects.toThrow(Error);
  });
});