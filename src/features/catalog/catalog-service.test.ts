import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FIXTURE_MOVIES } from "./catalog-fixtures";
import { getHomeCatalog } from "./catalog-service";
import type { CatalogState } from "./catalog-types";

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
  });
});