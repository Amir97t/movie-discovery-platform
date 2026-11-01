import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FIXTURE_MOVIES } from "./catalog-fixtures";
import {
  APPLICATION_PAGE_SIZE,
  clearApiMetadataCache,
  fetchPaginatedMoviesFromApi,
  fetchRawApiPage,
  GENRE_ALIASES,
  GENRE_KEY_TO_API_NAME,
  getAllMovies,
  getGenreFixtureFallback,
  getHeroCandidates,
  getHomeCatalog,
  getMovieById,
  getMovieByIdDirect,
  getMoviesByGenre,
  getMoviesByPage,
  getMoviesBySearch,
  MovieNotFoundError,
  paginateItems,
  resolveGenreKey,
  shuffleCandidates,
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

  it("returns a featured movie, picks containing all movies, and used genres, per locale", async () => {
    for (const locale of ["en", "fa"] as const) {
      const state = await getHomeCatalog(locale);
      expect(state.status).toBe("success");
      if (!isSuccessState(state)) return;
      expect(["fixture", "api"]).toContain(state.source);
      expect(state.data.picks.some((m) => m.id === state.data.featured.id)).toBe(true);
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
      expect(isSuccessState(state) && state.data.picks.length).toBe(1);
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
      createMockResponse([mockMovie], { current_page: "3", per_page: "15", page_count: "17", total_count: "250" }),
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
    fetchMock.mockResolvedValue(
      createMockResponse([mockMovie], { current_page: "1", per_page: "15", page_count: "1", total_count: "1" }),
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
      createMockResponse([mockMovie], { current_page: "1", per_page: "15", page_count: "4", total_count: "51" }),
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
        { current_page: "2", per_page: "15", page_count: "4", total_count: "51" },
      ),
    );

    const result = await getMoviesByGenre("Crime", 2);

    expect(result.metadata.current_page).toBe("2");
    expect(result.metadata.page_count).toBe("4");
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

  it("valid genre name (Crime) with HTTP 404 falls back to matching fixtures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    const result = await getMoviesByGenre("Crime", 1, "en");
    expect(result.source).toBe("fixture");
    expect(result.movies.length).toBeGreaterThan(0);
    for (const movie of result.movies) {
      expect(movie.genres).toContain("crime");
    }
  });

  it("Documentary API 404 returns matching fixtures with accurate count and metadata", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    const result = await getMoviesByGenre("Documentary", 1, "en");
    expect(result.source).toBe("fixture");
    expect(result.movies).toHaveLength(2);
    expect(result.metadata.total_count).toBe("2");
    expect(result.metadata.current_page).toBe("1");
    expect(result.metadata.per_page).toBe("15");
    expect(result.metadata.page_count).toBe("1");
    for (const movie of result.movies) {
      expect(movie.genres).toContain("documentary");
    }
  });

  it("Documentary successful empty response returns matching fixtures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([], {
        current_page: 1,
        per_page: 12,
        page_count: 0,
        total_count: 0,
      }),
    );

    const result = await getMoviesByGenre("Documentary", 1, "en");
    expect(result.source).toBe("fixture");
    expect(result.movies).toHaveLength(2);
    for (const movie of result.movies) {
      expect(movie.genres).toContain("documentary");
    }
  });

  it("Documentary network failure returns matching fixtures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Network down"));

    const result = await getMoviesByGenre("Documentary", 1, "en");
    expect(result.source).toBe("fixture");
    expect(result.movies).toHaveLength(2);
    for (const movie of result.movies) {
      expect(movie.genres).toContain("documentary");
    }
  });

  it("Documentary Persian fallback uses localized Persian titles", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    const result = await getMoviesByGenre("Documentary", 1, "fa");
    expect(result.source).toBe("fixture");
    expect(result.movies).toHaveLength(2);
    expect(result.movies[0].title).toBe("حلقه‌ی خاموش");
    for (const movie of result.movies) {
      expect(movie.genres).toContain("documentary");
      expect(movie.title.trim()).not.toBe("");
    }
  });

  it("valid genre without matching fixtures (Biography) remains empty on empty response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      createMockResponse([], {
        current_page: 1,
        per_page: 12,
        page_count: 0,
        total_count: 0,
      }),
    );

    const result = await getMoviesByGenre("Biography", 1, "en");
    expect(result.movies).toHaveLength(0);
    expect(result.metadata.total_count).toBe("0");
    expect(result.source).toBe("api");
  });

  it("valid genre without matching fixtures (Biography) remains empty on API 404 without returning unrelated movies", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(404));

    const result = await getMoviesByGenre("Biography", 1, "en");
    expect(result.movies).toHaveLength(0);
    expect(result.metadata.total_count).toBe("0");
    expect(result.source).toBe("fixture");
  });

  it("getGenreFixtureFallback paginates and localizes correctly", () => {
    const resEn = getGenreFixtureFallback("documentary", 1, "en");
    expect(resEn.source).toBe("fixture");
    expect(resEn.movies).toHaveLength(2);
    expect(resEn.movies[0].title).toBe("The Quiet Reel");

    const resFa = getGenreFixtureFallback("documentary", 1, "fa");
    expect(resFa.movies[0].title).toBe("حلقه‌ی خاموش");
  });

  it("unknown genre name throws MovieNotFoundError without falling back to unrelated fixtures", async () => {
    await expect(getMoviesByGenre("CompletelyUnknownGenre", 1)).rejects.toBeInstanceOf(
      MovieNotFoundError,
    );
  });

  it("valid genre name with network error falls back to localized fixtures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await getMoviesByGenre("Drama", 1, "en");

    expect(result.source).toBe("fixture");
    expect(result.movies.length).toBeGreaterThan(0);
    // Every movie returned must have the requested genre
    for (const movie of result.movies) {
      expect(movie.genres).toContain("drama");
    }
  });

  it("valid genre name with 5xx server error falls back to localized fixtures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(createMockErrorResponse(500));

    const result = await getMoviesByGenre("Drama", 1, "en");

    expect(result.source).toBe("fixture");
    expect(result.movies.length).toBeGreaterThan(0);
    for (const movie of result.movies) {
      expect(movie.genres).toContain("drama");
    }
  });

  it("valid genre name with malformed response falls back to localized fixtures", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: vi.fn().mockResolvedValue({ notData: "corrupted" }),
    } as unknown as Response);

    const result = await getMoviesByGenre("Action", 1, "en");

    expect(result.source).toBe("fixture");
    expect(result.movies.length).toBeGreaterThan(0);
    for (const movie of result.movies) {
      expect(movie.genres).toContain("action");
    }
  });

  it("returns Persian genre fallback with accurate metadata and source: fixture", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Network down"));

    const result = await getMoviesByGenre("Drama", 1, "fa");

    expect(result.source).toBe("fixture");
    expect(result.movies.length).toBeGreaterThan(0);
    expect(result.metadata.per_page).toBe("15");
    expect(Number(result.metadata.total_count)).toBeGreaterThan(0);

    // Verify Persian titles and synopses are localized
    for (const movie of result.movies) {
      expect(movie.title.trim()).not.toBe("");
      expect(movie.genres).toContain("drama");
    }
  });

  it("correctly filters fixtures by genre and does not silently return an unfiltered list", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError("Network down"));

    const dramaResult = await getMoviesByGenre("Drama", 1, "en");
    const scifiResult = await getMoviesByGenre("Sci-Fi", 1, "en");

    for (const movie of dramaResult.movies) {
      expect(movie.genres).toContain("drama");
    }
    for (const movie of scifiResult.movies) {
      expect(movie.genres).toContain("scifi");
    }

    // Results for Drama and Sci-Fi must not be identical lists
    const dramaIds = dramaResult.movies.map((m) => m.id);
    const scifiIds = scifiResult.movies.map((m) => m.id);
    expect(dramaIds).not.toEqual(scifiIds);
  });

  it("paginates filtered fixtures across page 1 and page 2 correctly", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError("Network down"));

    // If Drama has multiple pages or page 2 is requested:
    const page1 = await getMoviesByGenre("Drama", 1, "en");
    const page2 = await getMoviesByGenre("Drama", 2, "en");

    expect(page1.metadata.current_page).toBe("1");
    expect(page2.metadata.current_page).toBe("2");
    expect(page1.metadata.total_count).toBe(page2.metadata.total_count);

    const p1Ids = new Set(page1.movies.map((m) => m.id));
    for (const m of page2.movies) {
      expect(p1Ids.has(m.id)).toBe(false);
    }
  });
});

describe("Phase 2 & 2.1 - 15-movie pagination, hero candidates and metadata discovery", () => {
  beforeEach(() => {
    clearApiMetadataCache();
  });

  it("APPLICATION_PAGE_SIZE is 15", () => {
    expect(APPLICATION_PAGE_SIZE).toBe(15);
  });

  describe("resolveGenreKey", () => {
    it("maps diverse casing, variants, and aliases to canonical GenreKey", () => {
      expect(resolveGenreKey("Sci-Fi")).toBe("scifi");
      expect(resolveGenreKey("sci-fi")).toBe("scifi");
      expect(resolveGenreKey("scifi")).toBe("scifi");
      expect(resolveGenreKey("science-fiction")).toBe("scifi");
      expect(resolveGenreKey("sciencefiction")).toBe("scifi");
      expect(resolveGenreKey("Film-Noir")).toBe("filmNoir");
      expect(resolveGenreKey("filmNoir")).toBe("filmNoir");
      expect(resolveGenreKey("film-noir")).toBe("filmNoir");
      expect(resolveGenreKey("filmnoir")).toBe("filmNoir");
      expect(resolveGenreKey("Crime")).toBe("crime");
      expect(resolveGenreKey("crime")).toBe("crime");
      expect(resolveGenreKey("UNKNOWN")).toBeUndefined();
      expect(resolveGenreKey("superhero")).toBeUndefined();
      expect(resolveGenreKey("non-existent")).toBeUndefined();
      expect(resolveGenreKey("")).toBeUndefined();
      expect(resolveGenreKey("   ")).toBeUndefined();
    });

    it("GENRE_ALIASES includes documented aliases without mutating canonical keys", () => {
      expect(GENRE_ALIASES["science-fiction"]).toBe("scifi");
      expect(GENRE_ALIASES["sci-fi"]).toBe("scifi");
      expect(GENRE_ALIASES["film-noir"]).toBe("filmNoir");
    });
  });

  describe("getHeroCandidates & shuffleCandidates", () => {
    it("sorts and selects candidates by rating descending, giving preference to backdrops", () => {
      const candidates = getHeroCandidates([
        {
          id: "low-bd",
          title: "Low Rated with Backdrop",
          year: 2024,
          rating: 6.0,
          runtimeMinutes: 100,
          genres: ["action"],
          synopsis: null,
          posterUrl: null,
          backdropUrl: "https://example.com/low-bd.jpg",
          art: null,
          director: null,
          actors: null,
          country: null,
          imdb_id: null,
          imdb_rating: null,
          website: null,
        },
        {
          id: "high-bd",
          title: "High Rated with Backdrop",
          year: 2024,
          rating: 9.5,
          runtimeMinutes: 100,
          genres: ["action"],
          synopsis: null,
          posterUrl: null,
          backdropUrl: "https://example.com/high-bd.jpg",
          art: null,
          director: null,
          actors: null,
          country: null,
          imdb_id: null,
          imdb_rating: null,
          website: null,
        },
        {
          id: "mid-bd",
          title: "Mid Rated with Backdrop",
          year: 2024,
          rating: 8.0,
          runtimeMinutes: 100,
          genres: ["action"],
          synopsis: null,
          posterUrl: null,
          backdropUrl: "https://example.com/mid-bd.jpg",
          art: null,
          director: null,
          actors: null,
          country: null,
          imdb_id: null,
          imdb_rating: null,
          website: null,
        },
      ]);

      expect(candidates[0].id).toBe("high-bd");
      expect(candidates[1].id).toBe("mid-bd");
      expect(candidates[2].id).toBe("low-bd");
    });

    it("shuffleCandidates shuffles items using Fisher-Yates without losing elements", () => {
      const original = [1, 2, 3, 4, 5, 6];
      const shuffled = shuffleCandidates(original);

      expect(shuffled).toHaveLength(original.length);
      expect(new Set(shuffled)).toEqual(new Set(original));
    });
  });

  describe("paginateItems", () => {
    const items = Array.from({ length: 35 }, (_, i) => ({ id: `item-${i + 1}`, num: i + 1 }));

    it("paginates page 1 with 15 items and correct metadata", () => {
      const page1 = paginateItems(items, 1, 15);
      expect(page1.items).toHaveLength(15);
      expect(page1.items[0].id).toBe("item-1");
      expect(page1.items[14].id).toBe("item-15");
      expect(page1.metadata).toEqual({
        current_page: "1",
        per_page: "15",
        page_count: "3",
        total_count: "35",
      });
    });

    it("paginates page 2 with 15 items with distinct IDs", () => {
      const page1 = paginateItems(items, 1, 15);
      const page2 = paginateItems(items, 2, 15);
      expect(page2.items).toHaveLength(15);
      expect(page2.items[0].id).toBe("item-16");
      expect(page2.items[14].id).toBe("item-30");

      const p1Ids = new Set(page1.items.map((i) => i.id));
      const p2Ids = new Set(page2.items.map((i) => i.id));
      for (const id of p2Ids) {
        expect(p1Ids.has(id)).toBe(false);
      }
    });

    it("paginates partial final page (page 3) correctly", () => {
      const page3 = paginateItems(items, 3, 15);
      expect(page3.items).toHaveLength(5);
      expect(page3.items[0].id).toBe("item-31");
      expect(page3.items[4].id).toBe("item-35");
      expect(page3.metadata.current_page).toBe("3");
      expect(page3.metadata.page_count).toBe("3");
    });

    it("handles out of bounds page by returning empty list", () => {
      const page4 = paginateItems(items, 4, 15);
      expect(page4.items).toHaveLength(0);
      expect(page4.metadata.current_page).toBe("4");
      expect(page4.metadata.total_count).toBe("35");
    });
  });

  describe("fetchPaginatedMoviesFromApi (Multi-page aggregation & discovery)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("fetch", vi.fn());
      clearApiMetadataCache();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("aggregates two 12-item API pages into one 15-item application page (logical page 1)", async () => {
      const fetchMock = vi.mocked(fetch);

      const apiPage1 = Array.from({ length: 12 }, (_, i) => ({
        ...mockMovie,
        id: i + 1,
        title: `Movie ${i + 1}`,
      }));
      const apiPage2 = Array.from({ length: 12 }, (_, i) => ({
        ...mockMovie,
        id: i + 13,
        title: `Movie ${i + 13}`,
      }));

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(createMockResponse(apiPage1, {
            current_page: 1,
            per_page: 12,
            page_count: 3,
            total_count: 30,
          }));
        }
        if (urlStr.includes("page=2")) {
          return Promise.resolve(createMockResponse(apiPage2, {
            current_page: 2,
            per_page: 12,
            page_count: 3,
            total_count: 30,
          }));
        }
        return Promise.reject(new Error("Unexpected page"));
      });

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 1);

      expect(result.movies).toHaveLength(15);
      expect(result.movies[0].id).toBe("1");
      expect(result.movies[11].id).toBe("12");
      expect(result.movies[12].id).toBe("13");
      expect(result.movies[14].id).toBe("15");
      expect(result.metadata.per_page).toBe("15");
      expect(result.metadata.page_count).toBe("2");
      expect(result.metadata.total_count).toBe("30");

      const ids = new Set(result.movies.map((m) => m.id));
      expect(ids.size).toBe(15);
    });

    it("aggregates logical page 2 correctly from 12-item API pages", async () => {
      const fetchMock = vi.mocked(fetch);

      const apiPage1 = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      const apiPage2 = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 13 }));
      const apiPage3 = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 25 }));

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(createMockResponse(apiPage1, {
            current_page: 1,
            per_page: 12,
            page_count: 3,
            total_count: 35,
          }));
        }
        if (urlStr.includes("page=2")) {
          return Promise.resolve(createMockResponse(apiPage2, {
            current_page: 2,
            per_page: 12,
            page_count: 3,
            total_count: 35,
          }));
        }
        if (urlStr.includes("page=3")) {
          return Promise.resolve(createMockResponse(apiPage3, {
            current_page: 3,
            per_page: 12,
            page_count: 3,
            total_count: 35,
          }));
        }
        return Promise.reject(new Error(`Unexpected page: ${urlStr}`));
      });

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 2);

      expect(result.movies).toHaveLength(15);
      // Items on page 2: indices 15..29 (ids 16..30)
      expect(result.movies[0].id).toBe("16");
      expect(result.movies[14].id).toBe("30");
      expect(result.metadata.current_page).toBe("2");
    });

    it("handles native 15-item API pages directly on page 1 without redundant requests", async () => {
      const fetchMock = vi.mocked(fetch);
      const apiPage = Array.from({ length: 15 }, (_, i) => ({
        ...mockMovie,
        id: i + 1,
        title: `Native Movie ${i + 1}`,
      }));

      fetchMock.mockResolvedValueOnce(
        createMockResponse(apiPage, {
          current_page: 1,
          per_page: 15,
          page_count: 2,
          total_count: 30,
        }),
      );

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 1);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.movies).toHaveLength(15);
      expect(result.metadata.per_page).toBe("15");
      expect(result.metadata.page_count).toBe("2");
    });

    it("handles native 15-item API pages on logical page 6 without requesting incorrect page based on hardcoded 12", async () => {
      const fetchMock = vi.mocked(fetch);

      const metaPage = Array.from({ length: 15 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      const page6Movies = Array.from({ length: 15 }, (_, i) => ({
        ...mockMovie,
        id: i + 76,
        title: `Page 6 Movie ${i + 1}`,
      }));

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(createMockResponse(metaPage, {
            current_page: 1,
            per_page: 15,
            page_count: 10,
            total_count: 150,
          }));
        }
        if (urlStr.includes("page=6")) {
          return Promise.resolve(createMockResponse(page6Movies, {
            current_page: 6,
            per_page: 15,
            page_count: 10,
            total_count: 150,
          }));
        }
        return Promise.reject(new Error(`Requested wrong page: ${urlStr}`));
      });

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 6);

      // Verify that page 6 was requested directly rather than page 7 (which hardcoded 12 would calculate)
      expect(result.movies).toHaveLength(15);
      expect(result.movies[0].id).toBe("76");
      expect(result.metadata.current_page).toBe("6");
    });

    it("handles duplicate IDs at API page boundaries without returning short logical page", async () => {
      const fetchMock = vi.mocked(fetch);

      // Page 1 has items 1..12
      const apiPage1 = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      // Page 2 has item 12 repeated at boundary, plus items 13..24
      const apiPage2 = [
        { ...mockMovie, id: 12 }, // Duplicate ID at boundary!
        ...Array.from({ length: 11 }, (_, i) => ({ ...mockMovie, id: i + 13 })),
      ];

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(createMockResponse(apiPage1, {
            current_page: 1,
            per_page: 12,
            page_count: 3,
            total_count: 30,
          }));
        }
        if (urlStr.includes("page=2")) {
          return Promise.resolve(createMockResponse(apiPage2, {
            current_page: 2,
            per_page: 12,
            page_count: 3,
            total_count: 30,
          }));
        }
        return Promise.reject(new Error("Unexpected page"));
      });

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 1);

      // Deduplication must occur before slicing so that exactly 15 unique movies are returned
      expect(result.movies).toHaveLength(15);
      const ids = result.movies.map((m) => m.id);
      expect(new Set(ids).size).toBe(15);
      expect(ids).toContain("1");
      expect(ids).toContain("12");
      expect(ids).toContain("13");
      expect(ids).toContain("15");
    });

    it("ensures no duplicates across logical page 1 and page 2", async () => {
      const fetchMock = vi.mocked(fetch);

      const p1Movies = Array.from({ length: 15 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      const p2Movies = Array.from({ length: 15 }, (_, i) => ({ ...mockMovie, id: i + 16 }));

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(createMockResponse(p1Movies, {
            current_page: 1,
            per_page: 15,
            page_count: 2,
            total_count: 30,
          }));
        }
        if (urlStr.includes("page=2")) {
          return Promise.resolve(createMockResponse(p2Movies, {
            current_page: 2,
            per_page: 15,
            page_count: 2,
            total_count: 30,
          }));
        }
        return Promise.reject(new Error("Unexpected page"));
      });

      const page1 = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 1);
      const page2 = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 2);

      const p1Ids = new Set(page1.movies.map((m) => m.id));
      const p2Ids = new Set(page2.movies.map((m) => m.id));

      for (const id of p2Ids) {
        expect(p1Ids.has(id)).toBe(false);
      }
    });

    it("handles final partial page correctly", async () => {
      const fetchMock = vi.mocked(fetch);

      // Total count 18 with 12 items/page -> Page 2 has only 3 remaining items (18 - 15 = 3)
      const p1Api = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      const p2Api = Array.from({ length: 6 }, (_, i) => ({ ...mockMovie, id: i + 13 }));

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(createMockResponse(p1Api, {
            current_page: 1,
            per_page: 12,
            page_count: 2,
            total_count: 18,
          }));
        }
        if (urlStr.includes("page=2")) {
          return Promise.resolve(createMockResponse(p2Api, {
            current_page: 2,
            per_page: 12,
            page_count: 2,
            total_count: 18,
          }));
        }
        return Promise.reject(new Error("Unexpected page"));
      });

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 2);

      expect(result.movies).toHaveLength(3);
      expect(result.metadata.current_page).toBe("2");
      expect(result.metadata.total_count).toBe("18");
    });

    it("handles out of range page by returning empty list", async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 12,
          page_count: 1,
          total_count: 10,
        }),
      );

      const result = await fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 5);

      expect(result.movies).toHaveLength(0);
      expect(result.metadata.current_page).toBe("5");
      expect(result.metadata.total_count).toBe("10");
    });

    it("throws on invalid pagination metadata", async () => {
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: "invalid",
          page_count: 1,
          total_count: -10,
        }),
      );

      await expect(
        fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 1),
      ).rejects.toThrow("Invalid pagination metadata");
    });

    it("throws when upstream duplicate or inconsistent records prevent reaching expected count", async () => {
      const fetchMock = vi.mocked(fetch);

      // Claims total_count is 30, but page 1 and page 2 only contain 1 movie (repeated duplicate)
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          createMockResponse([{ ...mockMovie, id: 1 }], {
            current_page: 1,
            per_page: 12,
            page_count: 3,
            total_count: 30,
          }),
        ),
      );

      await expect(
        fetchPaginatedMoviesFromApi("https://moviesapi.codingfront.dev/api/v1/movies", 1),
      ).rejects.toThrow("Inconsistent upstream records");
    });

    it("ensures zero overlap across logical pages 1, 2, and 3 when upstream boundary duplicates exist (Regression Scenario)", async () => {
      const fetchMock = vi.mocked(fetch);

      // API page 1: IDs 1 through 12
      const apiPage1 = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      // API page 2: ID 12 repeated, IDs 13 through 23
      const apiPage2 = [
        { ...mockMovie, id: 12 },
        ...Array.from({ length: 11 }, (_, i) => ({ ...mockMovie, id: i + 13 })),
      ];
      // API page 3: IDs 24 through 35
      const apiPage3 = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 24 }));

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes("page=1")) {
          return Promise.resolve(
            createMockResponse(apiPage1, {
              current_page: 1,
              per_page: 12,
              page_count: 3,
              total_count: 35,
            }),
          );
        }
        if (urlStr.includes("page=2")) {
          return Promise.resolve(
            createMockResponse(apiPage2, {
              current_page: 2,
              per_page: 12,
              page_count: 3,
              total_count: 35,
            }),
          );
        }
        if (urlStr.includes("page=3")) {
          return Promise.resolve(
            createMockResponse(apiPage3, {
              current_page: 3,
              per_page: 12,
              page_count: 3,
              total_count: 35,
            }),
          );
        }
        return Promise.reject(new Error(`Unexpected page request: ${urlStr}`));
      });

      const page1 = await fetchPaginatedMoviesFromApi(
        "https://moviesapi.codingfront.dev/api/v1/movies",
        1,
      );
      const page2 = await fetchPaginatedMoviesFromApi(
        "https://moviesapi.codingfront.dev/api/v1/movies",
        2,
      );
      const page3 = await fetchPaginatedMoviesFromApi(
        "https://moviesapi.codingfront.dev/api/v1/movies",
        3,
      );

      const p1Ids = page1.movies.map((m) => m.id);
      const p2Ids = page2.movies.map((m) => m.id);
      const p3Ids = page3.movies.map((m) => m.id);

      // Logical page 1: IDs 1 through 15
      expect(p1Ids).toHaveLength(15);
      expect(p1Ids).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));

      // Logical page 2: IDs 16 through 30 (not 15 through 29)
      expect(p2Ids).toHaveLength(15);
      expect(p2Ids).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 16)));

      // Logical page 3: IDs 31 through 35 (final partial page of 5 items)
      expect(p3Ids).toHaveLength(5);
      expect(p3Ids).toEqual(Array.from({ length: 5 }, (_, i) => String(i + 31)));

      // No duplicate IDs within any single logical page
      expect(new Set(p1Ids).size).toBe(15);
      expect(new Set(p2Ids).size).toBe(15);
      expect(new Set(p3Ids).size).toBe(5);

      // Zero overlap across logical pages
      const overlapP1P2 = p1Ids.filter((id) => p2Ids.includes(id));
      const overlapP2P3 = p2Ids.filter((id) => p3Ids.includes(id));
      const overlapP1P3 = p1Ids.filter((id) => p3Ids.includes(id));

      expect(overlapP1P2).toEqual([]);
      expect(overlapP2P3).toEqual([]);
      expect(overlapP1P3).toEqual([]);

      // Metadata verification
      expect(page1.metadata).toEqual({
        current_page: "1",
        per_page: "15",
        page_count: "3",
        total_count: "35",
      });
      expect(page2.metadata).toEqual({
        current_page: "2",
        per_page: "15",
        page_count: "3",
        total_count: "35",
      });
      expect(page3.metadata).toEqual({
        current_page: "3",
        per_page: "15",
        page_count: "3",
        total_count: "35",
      });
    });
  });

  describe("fetchRawApiPage metadata validation (isolated tests)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("rejects when per_page is 'invalid' with valid total_count", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: "invalid",
          page_count: 1,
          total_count: 30,
        }),
      );

      await expect(
        fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1"),
      ).rejects.toThrow(/Invalid pagination metadata.*per_page/);
    });

    it("rejects when per_page is 0", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 0,
          page_count: 1,
          total_count: 30,
        }),
      );

      await expect(
        fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1"),
      ).rejects.toThrow(/Invalid pagination metadata.*per_page/);
    });

    it("rejects when per_page is negative", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: -12,
          page_count: 1,
          total_count: 30,
        }),
      );

      await expect(
        fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1"),
      ).rejects.toThrow(/Invalid pagination metadata.*per_page/);
    });

    it("rejects when total_count is 'invalid' with valid per_page", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 12,
          page_count: 1,
          total_count: "invalid",
        }),
      );

      await expect(
        fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1"),
      ).rejects.toThrow(/Invalid pagination metadata.*total_count/);
    });

    it("rejects when total_count is negative", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 12,
          page_count: 1,
          total_count: -10,
        }),
      );

      await expect(
        fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1"),
      ).rejects.toThrow(/Invalid pagination metadata.*total_count/);
    });

    it("rejects when required metadata is missing", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 12,
          // total_count and page_count missing
        }),
      );

      await expect(
        fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1"),
      ).rejects.toThrow(/Invalid pagination metadata/);
    });

    it("accepts a valid zero-result response without replacing with defaults", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([], {
          current_page: 1,
          per_page: 12,
          page_count: 0,
          total_count: 0,
        }),
      );

      const res = await fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1");
      expect(res.movies).toEqual([]);
      expect(res.metadata).toEqual({
        current_page: 1,
        per_page: 12,
        page_count: 0,
        total_count: 0,
      });
    });

    it("accepts a valid native 15-item response", async () => {
      const fetchMock = vi.mocked(fetch);
      const apiPage = Array.from({ length: 15 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      fetchMock.mockResolvedValueOnce(
        createMockResponse(apiPage, {
          current_page: 1,
          per_page: 15,
          page_count: 2,
          total_count: 30,
        }),
      );

      const res = await fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=1");
      expect(res.movies).toHaveLength(15);
      expect(res.metadata).toEqual({
        current_page: 1,
        per_page: 15,
        page_count: 2,
        total_count: 30,
      });
    });

    it("accepts a valid 12-item response", async () => {
      const fetchMock = vi.mocked(fetch);
      const apiPage = Array.from({ length: 12 }, (_, i) => ({ ...mockMovie, id: i + 1 }));
      fetchMock.mockResolvedValueOnce(
        createMockResponse(apiPage, {
          current_page: 2,
          per_page: 12,
          page_count: 3,
          total_count: 35,
        }),
      );

      const res = await fetchRawApiPage("https://moviesapi.codingfront.dev/api/v1/movies?page=2");
      expect(res.movies).toHaveLength(12);
      expect(res.metadata).toEqual({
        current_page: 2,
        per_page: 12,
        page_count: 3,
        total_count: 35,
      });
    });

    it("falls back to localized fixture when raw API metadata is malformed", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: "invalid",
          page_count: 1,
          total_count: 30,
        }),
      );

      const result = await getMoviesByPage(1, "fa");
      expect(result.source).toBe("fixture");
      expect(result.movies).toHaveLength(15);
      expect(result.metadata.per_page).toBe("15");
      expect(result.metadata.total_count).toBe(String(FIXTURE_MOVIES.length));
    });
  });

  describe("Fixture pagination fallback", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("returns 15 items on page 1 and remaining items on page 2 in Persian locale", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockRejectedValue(new TypeError("Network down"));

      const page1 = await getMoviesByPage(1, "fa");
      expect(page1.source).toBe("fixture");
      expect(page1.movies).toHaveLength(15);
      expect(page1.metadata.per_page).toBe("15");
      expect(page1.metadata.page_count).toBe("2");

      const page2 = await getMoviesByPage(2, "fa");
      expect(page2.source).toBe("fixture");
      expect(page2.movies).toHaveLength(10);
      expect(page2.metadata.current_page).toBe("2");

      const p1Ids = new Set(page1.movies.map((m) => m.id));
      const p2Ids = new Set(page2.movies.map((m) => m.id));
      for (const id of p2Ids) {
        expect(p1Ids.has(id)).toBe(false);
      }

      for (const movie of page1.movies) {
        expect(movie.title.trim()).not.toBe("");
      }
    });
  });

  describe("getMoviesBySearch", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("fetch", vi.fn());
      clearApiMetadataCache();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("1. constructs correct URLSearchParams for normal English query", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 15,
          page_count: 1,
          total_count: 1,
        }),
      );

      await getMoviesBySearch("the matrix", 1, "en");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const urlCalled = fetchMock.mock.calls[0][0] as string;
      expect(urlCalled).toContain("q=the+matrix");
    });

    it("2. encodes Persian and special characters in query correctly", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 15,
          page_count: 1,
          total_count: 1,
        }),
      );

      const query = "ماتریکس & جنگ ستارگان";
      await getMoviesBySearch(query, 1, "fa");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const urlCalled = fetchMock.mock.calls[0][0] as string;
      const expectedParam = new URLSearchParams({ q: query }).toString();
      expect(urlCalled).toContain(expectedParam);
    });

    it("3. preserves requested page parameter", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 2,
          per_page: 15,
          page_count: 3,
          total_count: 35,
        }),
      );

      const result = await getMoviesBySearch("action", 2, "en");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const urlCalled = fetchMock.mock.calls[0][0] as string;
      expect(urlCalled).toContain("page=2");
      expect(result.metadata.current_page).toBe("2");
    });

    it("4. normalizes valid API search response correctly", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse(
          [
            {
              id: 42,
              title: "Normalized Search Movie",
              year: "2021",
              runtime: "115 min",
              imdb_rating: "7.9",
              genres: ["Sci-Fi"],
              poster: "https://moviesapi.codingfront.dev/images/tt0042.jpg",
            },
          ],
          {
            current_page: 1,
            per_page: 15,
            page_count: 1,
            total_count: 1,
          },
        ),
      );

      const result = await getMoviesBySearch("search term", 1, "en");
      expect(result.source).toBe("api");
      expect(result.movies).toHaveLength(1);
      const m = result.movies[0];
      expect(m.id).toBe("42");
      expect(m.title).toBe("Normalized Search Movie");
      expect(m.year).toBe(2021);
      expect(m.runtimeMinutes).toBe(115);
      expect(m.rating).toBe(7.9);
      expect(m.genres).toEqual(["scifi"]);
      expect(m.posterUrl).toBe("https://moviesapi.codingfront.dev/images/tt0042.jpg");
    });

    it("5. aggregates multi-page API responses and deduplicates movie records", async () => {
      const fetchMock = vi.mocked(fetch);
      // First call discovers 12 items/page and total_count = 20
      const page1 = Array.from({ length: 12 }, (_, i) => ({
        ...mockMovie,
        id: i + 1,
        title: `Movie ${i + 1}`,
      }));
      // Page 2 includes duplicate ID 12
      const page2 = [
        { ...mockMovie, id: 12, title: "Duplicate Movie 12" },
        ...Array.from({ length: 7 }, (_, i) => ({
          ...mockMovie,
          id: i + 13,
          title: `Movie ${i + 13}`,
        })),
      ];

      fetchMock.mockResolvedValueOnce(
        createMockResponse(page1, {
          current_page: 1,
          per_page: 12,
          page_count: 2,
          total_count: 20,
        }),
      );
      fetchMock.mockResolvedValueOnce(
        createMockResponse(page2, {
          current_page: 2,
          per_page: 12,
          page_count: 2,
          total_count: 20,
        }),
      );

      const result = await getMoviesBySearch("hero", 1, "en");
      expect(result.source).toBe("api");
      expect(result.movies).toHaveLength(15);
      expect(result.metadata.per_page).toBe("15");

      // Verify no duplicates
      const ids = result.movies.map((m) => m.id);
      expect(new Set(ids).size).toBe(15);
    });

    it("6. keeps valid API empty response as a genuine empty result without overriding with fixtures", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([], {
          current_page: 1,
          per_page: 15,
          page_count: 0,
          total_count: 0,
        }),
      );

      const result = await getMoviesBySearch("lantern", 1, "en");
      expect(result.source).toBe("api");
      expect(result.movies).toHaveLength(0);
      expect(result.metadata.total_count).toBe("0");
    });

    it("7. falls back to matching localized fixtures on network error", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockRejectedValue(new TypeError("Network error"));

      // Search for "Lantern" which exists in fixtures ("The Lantern Archive" / "بایگانی فانوس")
      const enResult = await getMoviesBySearch("lantern", 1, "en");
      expect(enResult.source).toBe("fixture");
      expect(enResult.movies.length).toBeGreaterThanOrEqual(1);
      expect(enResult.movies[0].title).toBe("The Lantern Archive");

      // Search in Persian
      const faResult = await getMoviesBySearch("فانوس", 1, "fa");
      expect(faResult.source).toBe("fixture");
      expect(faResult.movies.length).toBeGreaterThanOrEqual(1);
      expect(faResult.movies[0].title).toBe("بایگانی فانوس");
    });

    it("8. falls back safely to fixtures on malformed API response", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ data: "corrupted_non_array_payload" }),
      } as unknown as Response);

      const result = await getMoviesBySearch("paper moons", 1, "en");
      expect(result.source).toBe("fixture");
      expect(result.movies.length).toBeGreaterThanOrEqual(1);
      expect(result.movies[0].title).toBe("Paper Moons Over Harbor City");
    });

    it("9. avoids making network requests for empty or whitespace query", async () => {
      const fetchMock = vi.mocked(fetch);

      const res1 = await getMoviesBySearch("", 1, "en");
      expect(res1.movies).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();

      const res2 = await getMoviesBySearch("   ", 1, "en");
      expect(res2.movies).toHaveLength(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("10. normalizes invalid page input safely to page 1", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        createMockResponse([mockMovie], {
          current_page: 1,
          per_page: 15,
          page_count: 1,
          total_count: 1,
        }),
      );

      const result = await getMoviesBySearch("query", -3 as number, "en");
      expect(result.metadata.current_page).toBe("1");
      const urlCalled = fetchMock.mock.calls[0][0] as string;
      expect(urlCalled).toContain("page=1");
    });

    it("11. returns source: 'fixture' with empty movies list when API fails and no local fixtures match the query", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockRejectedValue(new Error("HTTP 500"));

      const result = await getMoviesBySearch("fail_500", 1, "en");
      expect(result.source).toBe("fixture");
      expect(result.movies).toHaveLength(0);
      expect(result.metadata.total_count).toBe("0");
    });
  });
});
