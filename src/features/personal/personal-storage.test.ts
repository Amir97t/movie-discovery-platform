import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  addCommentInStore,
  areArtEqual,
  areGenresEqual,
  areRecordsEqual,
  areSnapshotsEqual,
  areStatesEqual,
  calculatePersonalStatistics,
  checkPersonalStorageAvailability,
  clearPersonalRatingInStore,
  createPersonalBackup,
  CURRENT_STORAGE_VERSION,
  deleteCommentInStore,
  getInitialPersonalState,
  getLatestRemoteSnapshot,
  getPersonalStorageSnapshot,
  getSafeLocalStorage,
  getSessionBaseSnapshot,
  hasPersonalData,
  hasPersonalSessionMutations,
  hasUnsupportedStorageVersion,
  INITIAL_PERSONAL_STATE,
  isLocalStorageAvailable,
  isPersonalStorageAvailable,
  isRecordEmpty,
  mergeImportedDataInStore,
  mergePersonalStates,
  PERSONAL_STORAGE_KEY,
  PERSONAL_UPDATE_EVENT,
  readPersonalStorage,
  resetPersonalDataInStore,
  resetPersonalStorageCache,
  safeReadPersonalStorage,
  sanitizeSnapshot,
  setPersonalRatingInStore,
  setPersonalStorageAvailable,
  sortLibraryMovies,
  STORAGE_PROBE_KEY,
  subscribePersonalStorage,
  threeWayMergeMovieSnapshot,
  threeWayMergePersonalStates,
  toggleFavoriteInStore,
  toggleWatchedInStore,
  toggleWatchlistInStore,
  updateProfileInStore,
  validateImportPayload,
  validatePersonalRating,
  writePersonalStorage,
} from "./personal-storage";
import type {
  MovieSnapshot,
  PersonalBackupV1,
  PersonalComment,
  PersonalRecord,
  PersonalStorageSchema,
} from "./personal-types";

const mockSnapshot: MovieSnapshot = {
  id: "test-movie-1",
  title: "Test Movie",
  year: 2024,
  rating: 8.5,
  posterUrl: "/test-poster.jpg",
  art: ["#111", "#222"],
  genres: ["drama", "action"],
};

describe("personal-storage edge cases & data integrity", () => {
  let mockStorage: Record<string, string>;
  let storageInterface: Storage;

  beforeEach(() => {
    vi.restoreAllMocks();
    resetPersonalStorageCache();
    window.localStorage.clear();
    mockStorage = {};
    storageInterface = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: (i: number) => Object.keys(mockStorage)[i] ?? null,
      length: 0,
    };
  });

  describe("Storage Failure Handling", () => {
    it("returns initial frozen state when storage is null or unavailable", () => {
      expect(readPersonalStorage(null)).toEqual(INITIAL_PERSONAL_STATE);
      expect(readPersonalStorage(storageInterface)).toEqual(INITIAL_PERSONAL_STATE);
    });

    it("handles getItem throwing an exception (e.g., SecurityError in private mode)", () => {
      const securityThrowingStorage = {
        ...storageInterface,
        getItem: () => {
          throw new Error("SecurityError: Access denied");
        },
      } as Storage;

      expect(readPersonalStorage(securityThrowingStorage)).toEqual(INITIAL_PERSONAL_STATE);
    });

    it("handles setItem throwing QuotaExceededError and returns false", () => {
      const quotaThrowingStorage = {
        ...storageInterface,
        setItem: () => {
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        },
      } as Storage;

      const state = toggleFavoriteInStore(getInitialPersonalState(), "m1", mockSnapshot);
      const success = writePersonalStorage(state, quotaThrowingStorage);

      expect(success).toBe(false);
      // In-memory snapshot still reflects the mutation for the active session
      expect(getPersonalStorageSnapshot().movies["m1"]?.isFavorite).toBe(true);
    });

    it("detects when localStorage is unavailable using isLocalStorageAvailable probe", () => {
      expect(isLocalStorageAvailable(storageInterface)).toBe(true);
      expect(isLocalStorageAvailable(null)).toBe(false);

      const failingStorage = {
        ...storageInterface,
        setItem: () => {
          throw new Error("Disabled");
        },
      } as Storage;
      expect(isLocalStorageAvailable(failingStorage)).toBe(false);
    });

    it("handles malformed JSON gracefully", () => {
      mockStorage[PERSONAL_STORAGE_KEY] = "{ not valid JSON ...";
      const loaded = readPersonalStorage(storageInterface);
      expect(loaded).toEqual(INITIAL_PERSONAL_STATE);
    });

    it("handles invalid schema version or corrupted movies shape", () => {
      mockStorage[PERSONAL_STORAGE_KEY] = JSON.stringify({
        version: 999,
        movies: "bad-data",
      });
      const loaded = readPersonalStorage(storageInterface);
      expect(loaded).toEqual(INITIAL_PERSONAL_STATE);
    });
  });

  describe("Record Pruning & Cleanup", () => {
    it("does NOT treat a valid numeric rating of 0 as empty", () => {
      const record: PersonalRecord = {
        id: "m1",
        snapshot: mockSnapshot,
        isFavorite: false,
        listStatus: null,
        personalRating: 0,
        comments: [],
        updatedAt: new Date().toISOString(),
      };
      expect(isRecordEmpty(record)).toBe(false);
    });

    it("does NOT treat a valid positive rating as empty", () => {
      const record: PersonalRecord = {
        id: "m1",
        snapshot: mockSnapshot,
        isFavorite: false,
        listStatus: null,
        personalRating: 7.5,
        comments: [],
        updatedAt: new Date().toISOString(),
      };
      expect(isRecordEmpty(record)).toBe(false);
    });

    it("treats an empty comments array as empty if no other personal data exists", () => {
      const record: PersonalRecord = {
        id: "m1",
        snapshot: mockSnapshot,
        isFavorite: false,
        listStatus: null,
        personalRating: null,
        comments: [],
        updatedAt: new Date().toISOString(),
      };
      expect(isRecordEmpty(record)).toBe(true);
    });

    it("does NOT treat a non-empty comments array as empty", () => {
      const record: PersonalRecord = {
        id: "m1",
        snapshot: mockSnapshot,
        isFavorite: false,
        listStatus: null,
        personalRating: null,
        comments: [{ id: "c1", text: "Brilliant cinematography", createdAt: "2026-11-04" }],
        updatedAt: new Date().toISOString(),
      };
      expect(isRecordEmpty(record)).toBe(false);
    });

    it("cleans up record when favorite, watchlist, and watched are all cleared", () => {
      let state = getInitialPersonalState();
      state = toggleFavoriteInStore(state, "m1", mockSnapshot);
      expect(state.movies["m1"]).toBeDefined();

      state = toggleFavoriteInStore(state, "m1", mockSnapshot);
      expect(state.movies["m1"]).toBeUndefined();
    });
  });

  describe("Snapshot Sanitization & useSyncExternalStore Stability", () => {
    it("sanitizes malformed snapshot data", () => {
      const badSnapshot = {
        id: "  ",
        title: "",
        year: "invalid-year",
        rating: NaN,
        art: ["#fff"], // invalid length
        genres: [123, "drama"],
      };

      const sanitized = sanitizeSnapshot(badSnapshot, "fallback-id");
      expect(sanitized.id).toBe("fallback-id");
      expect(sanitized.title).toBe("Untitled");
      expect(sanitized.year).toBeNull();
      expect(sanitized.rating).toBeNull();
      expect(sanitized.art).toBeNull();
      expect(sanitized.genres).toEqual(["drama"]);
    });

    it("maintains stable cached snapshot reference when state has not changed", () => {
      writePersonalStorage(getInitialPersonalState(), storageInterface);
      const snap1 = getPersonalStorageSnapshot();
      const snap2 = getPersonalStorageSnapshot();

      expect(snap1).toBe(snap2); // Strict reference equality (===)
    });

    it("provides stable frozen reference from getInitialPersonalState for SSR", () => {
      const initial1 = getInitialPersonalState();
      const initial2 = getInitialPersonalState();

      expect(initial1).toBe(initial2);
      expect(Object.isFrozen(initial1)).toBe(true);
    });
  });

  describe("Data Integrity & Mutex Transitions", () => {
    it("Favorite remains independent of Watchlist and Watched", () => {
      let state = getInitialPersonalState();
      state = toggleFavoriteInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.isFavorite).toBe(true);
      expect(state.movies["test-movie-1"]?.listStatus).toBeNull();

      state = toggleWatchlistInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.isFavorite).toBe(true);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watchlist");

      state = toggleWatchedInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.isFavorite).toBe(true);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watched");

      state = toggleFavoriteInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.isFavorite).toBe(false);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watched");
    });

    it("Marking Watched removes movie from Watchlist", () => {
      let state = getInitialPersonalState();
      state = toggleWatchlistInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watchlist");

      state = toggleWatchedInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watched");
    });

    it("Adding to Watchlist removes movie from Watched", () => {
      let state = getInitialPersonalState();
      state = toggleWatchedInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watched");

      state = toggleWatchlistInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watchlist");
    });

    it("Unmarking Watched does not add to Watchlist", () => {
      let state = getInitialPersonalState();
      state = toggleFavoriteInStore(state, "test-movie-1", mockSnapshot);
      state = toggleWatchedInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.listStatus).toBe("watched");

      state = toggleWatchedInStore(state, "test-movie-1", mockSnapshot);
      expect(state.movies["test-movie-1"]?.listStatus).toBeNull();
    });
  });

  describe("Personal Ratings Domain & Invariants", () => {
    it("validates rating numbers correctly (0-10 inclusive, 0.5 increments, finite)", () => {
      expect(validatePersonalRating(0)).toBe(0);
      expect(validatePersonalRating(0.5)).toBe(0.5);
      expect(validatePersonalRating(5)).toBe(5);
      expect(validatePersonalRating(8.5)).toBe(8.5);
      expect(validatePersonalRating(9.5)).toBe(9.5);
      expect(validatePersonalRating(10)).toBe(10);

      // Rejects non-multiples of 0.5
      expect(validatePersonalRating(7.2)).toBeNull();
      expect(validatePersonalRating(7.3)).toBeNull();
      expect(validatePersonalRating(0.1)).toBeNull();

      // Rejects out of range (inclusive 0 to 10)
      expect(validatePersonalRating(-0.5)).toBeNull();
      expect(validatePersonalRating(-1)).toBeNull();
      expect(validatePersonalRating(10.5)).toBeNull();
      expect(validatePersonalRating(11)).toBeNull();

      // Rejects non-finite & invalid types
      expect(validatePersonalRating(NaN)).toBeNull();
      expect(validatePersonalRating(Infinity)).toBeNull();
      expect(validatePersonalRating(-Infinity)).toBeNull();
      expect(validatePersonalRating("9")).toBeNull();
      expect(validatePersonalRating(null)).toBeNull();
    });

    it("sets, updates, and clears personal ratings", () => {
      let state = getInitialPersonalState();
      state = setPersonalRatingInStore(state, "m1", mockSnapshot, 8.5);
      expect(state.movies["m1"]?.personalRating).toBe(8.5);

      // Updating rating
      state = setPersonalRatingInStore(state, "m1", mockSnapshot, 9.0);
      expect(state.movies["m1"]?.personalRating).toBe(9.0);

      // Rating 0 is explicitly valid and preserved
      state = setPersonalRatingInStore(state, "m1", mockSnapshot, 0);
      expect(state.movies["m1"]?.personalRating).toBe(0);

      // Clearing rating prunes record if no other data
      state = clearPersonalRatingInStore(state, "m1");
      expect(state.movies["m1"]).toBeUndefined();
    });

    it("rating changes do NOT alter Favorites, Watchlist, or Watched", () => {
      let state = getInitialPersonalState();
      state = toggleFavoriteInStore(state, "m1", mockSnapshot);
      state = toggleWatchlistInStore(state, "m1", mockSnapshot);
      expect(state.movies["m1"]?.isFavorite).toBe(true);
      expect(state.movies["m1"]?.listStatus).toBe("watchlist");

      state = setPersonalRatingInStore(state, "m1", mockSnapshot, 9.5);
      expect(state.movies["m1"]?.isFavorite).toBe(true);
      expect(state.movies["m1"]?.listStatus).toBe("watchlist");
      expect(state.movies["m1"]?.personalRating).toBe(9.5);

      state = clearPersonalRatingInStore(state, "m1");
      expect(state.movies["m1"]?.isFavorite).toBe(true);
      expect(state.movies["m1"]?.listStatus).toBe("watchlist");
      expect(state.movies["m1"]?.personalRating).toBeNull();
    });
  });

  describe("Local Comments Domain & Invariants", () => {
    const comment1: PersonalComment = {
      id: "c1",
      text: "Outstanding cinematography and score.",
      createdAt: "2026-11-04T12:00:00Z",
    };
    const comment2: PersonalComment = {
      id: "c2",
      text: "Must rewatch the ending scene.",
      createdAt: "2026-11-04T12:10:00Z",
    };

    it("adds and prepends comments correctly", () => {
      let state = getInitialPersonalState();
      state = addCommentInStore(state, "m1", mockSnapshot, comment1);
      expect(state.movies["m1"]?.comments).toHaveLength(1);
      expect(state.movies["m1"]?.comments?.[0]?.text).toBe(comment1.text);

      state = addCommentInStore(state, "m1", mockSnapshot, comment2);
      expect(state.movies["m1"]?.comments).toHaveLength(2);
      expect(state.movies["m1"]?.comments?.[0]?.id).toBe("c2"); // Prepend newest
    });

    it("trims whitespace and rejects empty comments", () => {
      let state = getInitialPersonalState();
      const emptyComment: PersonalComment = {
        id: "c_empty",
        text: "    ",
        createdAt: "2026-11-04T12:00:00Z",
      };
      state = addCommentInStore(state, "m1", mockSnapshot, emptyComment);
      expect(state.movies["m1"]).toBeUndefined();
    });

    it("truncates comment text exceeding 1000 characters", () => {
      let state = getInitialPersonalState();
      const longText = "a".repeat(1200);
      const longComment: PersonalComment = {
        id: "c_long",
        text: longText,
        createdAt: "2026-11-04T12:00:00Z",
      };
      state = addCommentInStore(state, "m1", mockSnapshot, longComment);
      expect(state.movies["m1"]?.comments?.[0]?.text).toHaveLength(1000);
    });

    it("prevents duplicate comment IDs", () => {
      let state = getInitialPersonalState();
      state = addCommentInStore(state, "m1", mockSnapshot, comment1);
      state = addCommentInStore(state, "m1", mockSnapshot, comment1);
      expect(state.movies["m1"]?.comments).toHaveLength(1);
    });

    it("deletes a comment and prunes record only when all data is empty", () => {
      let state = getInitialPersonalState();
      state = addCommentInStore(state, "m1", mockSnapshot, comment1);
      state = addCommentInStore(state, "m1", mockSnapshot, comment2);
      expect(state.movies["m1"]?.comments).toHaveLength(2);

      // Delete one comment
      state = deleteCommentInStore(state, "m1", "c1");
      expect(state.movies["m1"]?.comments).toHaveLength(1);
      expect(state.movies["m1"]?.comments?.[0]?.id).toBe("c2");

      // Delete final comment - record pruned
      state = deleteCommentInStore(state, "m1", "c2");
      expect(state.movies["m1"]).toBeUndefined();
    });

    it("preserves record after comment deletion if movie is a Favorite", () => {
      let state = getInitialPersonalState();
      state = toggleFavoriteInStore(state, "m1", mockSnapshot);
      state = addCommentInStore(state, "m1", mockSnapshot, comment1);
      expect(state.movies["m1"]?.isFavorite).toBe(true);
      expect(state.movies["m1"]?.comments).toHaveLength(1);

      state = deleteCommentInStore(state, "m1", "c1");
      expect(state.movies["m1"]).toBeDefined();
      expect(state.movies["m1"]?.isFavorite).toBe(true);
      expect(state.movies["m1"]?.comments).toHaveLength(0);
    });

    it("isolates comments between different movies", () => {
      const mockSnapshot2: MovieSnapshot = {
        ...mockSnapshot,
        id: "m2",
        title: "Movie Two",
      };
      let state = getInitialPersonalState();
      state = addCommentInStore(state, "m1", mockSnapshot, comment1);
      state = addCommentInStore(state, "m2", mockSnapshot2, comment2);

      expect(state.movies["m1"]?.comments).toHaveLength(1);
      expect(state.movies["m2"]?.comments).toHaveLength(1);

      state = deleteCommentInStore(state, "m1", "c1");
      expect(state.movies["m1"]).toBeUndefined();
      expect(state.movies["m2"]?.comments).toHaveLength(1);
    });
  });

  describe("Personal Profile Domain", () => {
    it("updates display name and bio with length limits and trimming", () => {
      let state = getInitialPersonalState();
      state = updateProfileInStore(state, {
        displayName: "  Cinephile  ",
        bio: "  Lover of film noir and classics.  ",
      });

      expect(state.profile?.displayName).toBe("Cinephile");
      expect(state.profile?.bio).toBe("Lover of film noir and classics.");

      // Enforces maximum length limits
      const overLongName = "A".repeat(100);
      const overLongBio = "B".repeat(500);
      state = updateProfileInStore(state, {
        displayName: overLongName,
        bio: overLongBio,
      });

      expect(state.profile?.displayName).toHaveLength(50);
      expect(state.profile?.bio).toHaveLength(280);
    });
  });

  describe("Personal Statistics Calculation", () => {
    it("calculates statistics accurately including zero rating and genre counts", () => {
      let state = getInitialPersonalState();

      // Empty state
      const initialStats = calculatePersonalStatistics(state);
      expect(initialStats.favoritesCount).toBe(0);
      expect(initialStats.watchlistCount).toBe(0);
      expect(initialStats.watchedCount).toBe(0);
      expect(initialStats.ratedCount).toBe(0);
      expect(initialStats.averageRating).toBeNull();
      expect(initialStats.totalCommentsCount).toBe(0);
      expect(initialStats.favoriteGenres).toEqual([]);

      // Movie 1: Favorite + Watched, rating 8.0, genres: sci-fi, drama
      const snap1: MovieSnapshot = {
        ...mockSnapshot,
        id: "m1",
        genres: ["sci-fi", "drama"],
      };
      state = toggleFavoriteInStore(state, "m1", snap1);
      state = toggleWatchedInStore(state, "m1", snap1);
      state = setPersonalRatingInStore(state, "m1", snap1, 8.0);

      // Movie 2: Favorite only, rating 0 (valid zero rating), genres: sci-fi
      const snap2: MovieSnapshot = {
        ...mockSnapshot,
        id: "m2",
        genres: ["sci-fi"],
      };
      state = toggleFavoriteInStore(state, "m2", snap2);
      state = setPersonalRatingInStore(state, "m2", snap2, 0);

      // Movie 3: Watchlist only, no rating, 2 comments, genres: action (not favorite, so shouldn't count in favoriteGenres)
      const snap3: MovieSnapshot = {
        ...mockSnapshot,
        id: "m3",
        genres: ["action"],
      };
      state = toggleWatchlistInStore(state, "m3", snap3);
      state = addCommentInStore(state, "m3", snap3, {
        id: "c1",
        text: "Note 1",
        createdAt: "2026-11-04T10:00:00Z",
      });
      state = addCommentInStore(state, "m3", snap3, {
        id: "c2",
        text: "Note 2",
        createdAt: "2026-11-04T11:00:00Z",
      });

      const stats = calculatePersonalStatistics(state);
      expect(stats.favoritesCount).toBe(2);
      expect(stats.watchlistCount).toBe(1);
      expect(stats.watchedCount).toBe(1);
      expect(stats.ratedCount).toBe(2); // m1 (8.0) and m2 (0)
      expect(stats.averageRating).toBe(4.0); // (8 + 0) / 2 = 4.0
      expect(stats.totalCommentsCount).toBe(2);

      // Favorite genres must strictly use favorited movies (m1 and m2)
      // sci-fi: 2, drama: 1. action (m3) should not be included.
      expect(stats.favoriteGenres).toEqual([
        { genre: "sci-fi", count: 2 },
        { genre: "drama", count: 1 },
      ]);
    });
  });

  describe("Library Sorting", () => {
    const movieA: PersonalRecord = {
      id: "a",
      snapshot: { ...mockSnapshot, id: "a", title: "Alpha", year: 2020, rating: 7.0 },
      isFavorite: true,
      listStatus: "watched",
      updatedAt: "2026-11-01T10:00:00Z",
    };
    const movieB: PersonalRecord = {
      id: "b",
      snapshot: { ...mockSnapshot, id: "b", title: "Beta", year: 2024, rating: 9.0 },
      isFavorite: true,
      listStatus: "watched",
      updatedAt: "2026-11-04T12:00:00Z",
    };
    const movieC: PersonalRecord = {
      id: "c",
      snapshot: { ...mockSnapshot, id: "c", title: "Gamma", year: 2018, rating: 8.5 },
      isFavorite: true,
      listStatus: "watched",
      updatedAt: "2026-11-03T10:00:00Z",
    };

    const records = [movieA, movieB, movieC];

    it("sorts by recently-updated with title fallback", () => {
      const sorted = sortLibraryMovies(records, "recently-updated");
      expect(sorted.map((m) => m.id)).toEqual(["b", "c", "a"]);
    });

    it("sorts by title-asc deterministically", () => {
      const sorted = sortLibraryMovies(records, "title-asc");
      expect(sorted.map((m) => m.id)).toEqual(["a", "b", "c"]);
    });

    it("sorts by year-desc with title fallback", () => {
      const sorted = sortLibraryMovies(records, "year-desc");
      expect(sorted.map((m) => m.id)).toEqual(["b", "a", "c"]);
    });

    it("sorts by rating-desc with title fallback", () => {
      const sorted = sortLibraryMovies(records, "rating-desc");
      expect(sorted.map((m) => m.id)).toEqual(["b", "c", "a"]);
    });
  });

  describe("JSON Export, Import & Reset", () => {
    it("creates valid backup payload and exports correct metadata", () => {
      let state = getInitialPersonalState();
      state = updateProfileInStore(state, { displayName: "Amir", bio: "Developer" });
      state = toggleFavoriteInStore(state, "m1", mockSnapshot);
      state = setPersonalRatingInStore(state, "m1", mockSnapshot, 9.5);

      const backup = createPersonalBackup(state);
      expect(backup.format).toBe("movie-discovery-platform-backup");
      expect(backup.version).toBe(1);
      expect(backup.exportedAt).toBeDefined();
      expect(backup.profile?.displayName).toBe("Amir");
      expect(backup.movies["m1"]?.personalRating).toBe(9.5);
    });

    it("validates backup payloads and rejects malformed files", () => {
      expect(validateImportPayload(null).success).toBe(false);
      expect(validateImportPayload({}).success).toBe(false);
      expect(validateImportPayload({ format: "wrong", version: 1, movies: {} }).success).toBe(false);
      expect(validateImportPayload({ format: "movie-discovery-platform-backup", version: 2, movies: {} }).success).toBe(false);

      // Invalid rating in movie
      const invalidRatingPayload = {
        format: "movie-discovery-platform-backup",
        version: 1,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            personalRating: 15, // Out of range!
          },
        },
      };
      const invalidResult = validateImportPayload(invalidRatingPayload);
      expect(invalidResult.success).toBe(false);

      // Valid payload
      const validPayload = {
        format: "movie-discovery-platform-backup",
        version: 1,
        exportedAt: "2026-11-05T00:00:00Z",
        profile: { displayName: "Valid User", bio: "Bio" },
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: "watched",
            personalRating: 8.5,
            comments: [{ id: "c1", text: "Nice", createdAt: "2026-11-04T00:00:00Z" }],
          },
        },
      };
      const validResult = validateImportPayload(validPayload);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.summary.moviesCount).toBe(1);
        expect(validResult.summary.favoritesCount).toBe(1);
        expect(validResult.summary.watchedCount).toBe(1);
        expect(validResult.summary.ratedCount).toBe(1);
        expect(validResult.summary.commentsCount).toBe(1);
        expect(validResult.summary.hasProfile).toBe(true);
      }
    });

    it("merges imported data with conflict resolution rules", () => {
      let current = getInitialPersonalState();
      // Current has m1 as Favorite only, updated earlier
      current = toggleFavoriteInStore(current, "m1", { ...mockSnapshot, id: "m1" });
      current.movies["m1"]!.updatedAt = "2026-11-01T10:00:00Z";

      // Current has m2 as Watched
      current = toggleWatchedInStore(current, "m2", { ...mockSnapshot, id: "m2" });

      // Backup has m1 as Watched (newer timestamp) and m3 as Watchlist
      const backup: PersonalBackupV1 = {
        format: "movie-discovery-platform-backup",
        version: 1,
        exportedAt: "2026-11-05T00:00:00Z",
        profile: { displayName: "Imported Profile", bio: "New Bio" },
        movies: {
          m1: {
            id: "m1",
            snapshot: { ...mockSnapshot, id: "m1" },
            isFavorite: false,
            listStatus: "watched",
            personalRating: 9.0,
            updatedAt: "2026-11-04T12:00:00Z",
          },
          m3: {
            id: "m3",
            snapshot: { ...mockSnapshot, id: "m3" },
            isFavorite: true,
            listStatus: "watchlist",
            updatedAt: "2026-11-03T10:00:00Z",
          },
        },
      };

      const merged = mergeImportedDataInStore(current, backup);

      // m1: Favorite union (true from current), listStatus watched (from backup), rating 9.0
      expect(merged.movies["m1"]?.isFavorite).toBe(true);
      expect(merged.movies["m1"]?.listStatus).toBe("watched");
      expect(merged.movies["m1"]?.personalRating).toBe(9.0);

      // m2: Preserved from current
      expect(merged.movies["m2"]?.listStatus).toBe("watched");

      // m3: Added from backup
      expect(merged.movies["m3"]?.listStatus).toBe("watchlist");

      // Profile: applied from backup
      expect(merged.profile?.displayName).toBe("Imported Profile");
    });

    it("rejects backup payload completely when any comment exceeds 1,000 characters", () => {
      const longComment = "a".repeat(1001);
      const payloadWithLongComment = {
        format: "movie-discovery-platform-backup",
        version: 1,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            comments: [{ id: "c1", text: longComment, createdAt: "2026-11-05T00:00:00Z" }],
          },
        },
      };
      const res = validateImportPayload(payloadWithLongComment);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain("exceeds 1000 characters");
      }
    });

    it("resolves watchlist vs watched conflicts deterministically by timestamp and tie rules", () => {
      const baseSnapshot = { ...mockSnapshot, id: "test-tie" };

      // Case A: Imported is newer (watchlist wins)
      const stateA = {
        version: 1 as const,
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watched" as const,
            updatedAt: "2026-11-01T10:00:00Z",
          },
        },
      };
      const backupA: PersonalBackupV1 = {
        format: "movie-discovery-platform-backup",
        version: 1,
        exportedAt: "2026-11-05T00:00:00Z",
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watchlist" as const,
            updatedAt: "2026-11-03T10:00:00Z", // Newer!
          },
        },
      };
      expect(mergeImportedDataInStore(stateA, backupA).movies["test-tie"]?.listStatus).toBe("watchlist");

      // Case B: Existing is newer (watched wins)
      const stateB = {
        version: 1 as const,
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watched" as const,
            updatedAt: "2026-11-04T10:00:00Z", // Newer!
          },
        },
      };
      const backupB: PersonalBackupV1 = {
        format: "movie-discovery-platform-backup",
        version: 1,
        exportedAt: "2026-11-05T00:00:00Z",
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watchlist" as const,
            updatedAt: "2026-11-02T10:00:00Z",
          },
        },
      };
      expect(mergeImportedDataInStore(stateB, backupB).movies["test-tie"]?.listStatus).toBe("watched");

      // Case C: Exact equal timestamps tie rule -> watched wins
      const stateC = {
        version: 1 as const,
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watchlist" as const,
            updatedAt: "2026-11-01T12:00:00Z",
          },
        },
      };
      const backupC: PersonalBackupV1 = {
        format: "movie-discovery-platform-backup",
        version: 1,
        exportedAt: "2026-11-05T00:00:00Z",
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watched" as const,
            updatedAt: "2026-11-01T12:00:00Z", // Exact same timestamp!
          },
        },
      };
      expect(mergeImportedDataInStore(stateC, backupC).movies["test-tie"]?.listStatus).toBe("watched");

      // Case D: One invalid timestamp -> valid timestamp wins
      const stateD = {
        version: 1 as const,
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watchlist" as const,
            updatedAt: "2026-11-02T10:00:00Z",
          },
        },
      };
      const backupD: PersonalBackupV1 = {
        format: "movie-discovery-platform-backup",
        version: 1,
        exportedAt: "2026-11-05T00:00:00Z",
        movies: {
          "test-tie": {
            id: "test-tie",
            snapshot: baseSnapshot,
            isFavorite: false,
            listStatus: "watched" as const,
            updatedAt: "invalid-timestamp",
          },
        },
      };
      expect(mergeImportedDataInStore(stateD, backupD).movies["test-tie"]?.listStatus).toBe("watchlist");
    });

    it("resets personal data back to initial empty state", () => {
      const resetState = resetPersonalDataInStore();
      expect(resetState.version).toBe(1);
      expect(Object.keys(resetState.movies)).toHaveLength(0);
      expect(resetState.profile).toBeUndefined();
    });
  });

  describe("Snapshot Purity & Stability (useSyncExternalStore)", () => {
    it("repeated availability snapshot reads do not call setItem or removeItem", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

      for (let i = 0; i < 50; i++) {
        const available = isPersonalStorageAvailable();
        expect(available).toBe(true);
      }

      expect(setItemSpy).not.toHaveBeenCalled();
      expect(removeItemSpy).not.toHaveBeenCalled();
    });

    it("snapshot reads return a stable cached value until availability actually changes", () => {
      expect(isPersonalStorageAvailable()).toBe(true);

      setPersonalStorageAvailable(false);
      expect(isPersonalStorageAvailable()).toBe(false);

      setPersonalStorageAvailable(true);
      expect(isPersonalStorageAvailable()).toBe(true);
    });

    it("notifies subscribers only when availability actually changes", () => {
      const listener = vi.fn();
      const unsubscribe = subscribePersonalStorage(listener);

      setPersonalStorageAvailable(false);
      expect(listener).toHaveBeenCalledTimes(1);

      // Same value: must NOT notify again
      setPersonalStorageAvailable(false);
      expect(listener).toHaveBeenCalledTimes(1);

      // Changed value: must notify
      setPersonalStorageAvailable(true);
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    });
  });

  describe("Safe window.localStorage Access & SecurityError Handling", () => {
    it("accessing window.localStorage through a getter that throws SecurityError does not crash the application", () => {
      const originalLocalStorage = window.localStorage;
      try {
        Object.defineProperty(window, "localStorage", {
          get: () => {
            throw new DOMException("The operation is insecure.", "SecurityError");
          },
          configurable: true,
        });

        // Safe getter returns null
        expect(getSafeLocalStorage()).toBeNull();

        // readPersonalStorage handles null storage safely
        expect(readPersonalStorage()).toEqual(INITIAL_PERSONAL_STATE);

        // isLocalStorageAvailable returns false
        expect(isLocalStorageAvailable()).toBe(false);

        // checkPersonalStorageAvailability returns false safely
        expect(checkPersonalStorageAvailability()).toBe(false);

        // writePersonalStorage handles null safely and returns false (session-only memory state)
        const state = toggleFavoriteInStore(getInitialPersonalState(), "m-sec", mockSnapshot);
        const persisted = writePersonalStorage(state);
        expect(persisted).toBe(false);
        expect(getPersonalStorageSnapshot().movies["m-sec"]?.isFavorite).toBe(true);
      } finally {
        Object.defineProperty(window, "localStorage", {
          value: originalLocalStorage,
          configurable: true,
          writable: true,
        });
      }
    });

    it("session-only fallback remains functional when persistent storage writes fail", () => {
      const failingStorage = {
        ...storageInterface,
        setItem: () => {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        },
      } as Storage;

      let state = getInitialPersonalState();
      state = toggleFavoriteInStore(state, "movie-sess-1", mockSnapshot);
      const persisted = writePersonalStorage(state, failingStorage);

      expect(persisted).toBe(false);
      expect(isPersonalStorageAvailable()).toBe(false);
      // In-memory snapshot still reflects the mutation for active session continuity
      expect(getPersonalStorageSnapshot().movies["movie-sess-1"]?.isFavorite).toBe(true);
    });
  });

  describe("Cross-Tab Storage Event Filtering & Feedback Loop Prevention", () => {
    it("an event for PERSONAL_STORAGE_KEY updates in-memory snapshot and notifies subscribers", () => {
      const listener = vi.fn();
      const unsubscribe = subscribePersonalStorage(listener);

      // Populate mock data in localStorage
      const updatedState = toggleFavoriteInStore(getInitialPersonalState(), "movie-remote-1", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(updatedState));

      // Dispatch cross-tab storage event
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(updatedState),
        })
      );

      expect(listener).toHaveBeenCalled();
      expect(getPersonalStorageSnapshot().movies["movie-remote-1"]?.isFavorite).toBe(true);

      unsubscribe();
    });

    it("an unrelated key does not trigger personal-data update or subscriber notification", () => {
      const listener = vi.fn();
      const unsubscribe = subscribePersonalStorage(listener);
      listener.mockClear();

      // Dispatch unrelated storage events (e.g. appearance preferences or analytics)
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "frame-appearance",
          newValue: JSON.stringify({ mode: "dark" }),
        })
      );

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "unrelated_app_setting",
          newValue: "42",
        })
      );

      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("a temporary probe-key event (__mdp_storage_probe__) does not trigger repeated availability check or notification", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      const listener = vi.fn();
      const unsubscribe = subscribePersonalStorage(listener);
      listener.mockClear();
      setItemSpy.mockClear();

      // Dispatch storage event caused by a probe in another tab
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_PROBE_KEY,
          newValue: "1",
        })
      );

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_PROBE_KEY,
          newValue: null,
        })
      );

      // Must NOT notify personal subscribers
      expect(listener).not.toHaveBeenCalled();

      // Must NOT trigger a probe check (no setItem calls)
      expect(setItemSpy).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("handling localStorage.clear() (event.key === null) resets in-memory snapshot without triggering probe", () => {
      // First populate some state
      const stateWithMovie = toggleFavoriteInStore(getInitialPersonalState(), "movie-to-clear", mockSnapshot);
      writePersonalStorage(stateWithMovie);
      expect(getPersonalStorageSnapshot().movies["movie-to-clear"]).toBeDefined();

      const listener = vi.fn();
      const unsubscribe = subscribePersonalStorage(listener);
      listener.mockClear();

      window.localStorage.clear();

      // Dispatch storage event representing localStorage.clear()
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
        })
      );

      expect(listener).toHaveBeenCalled();
      expect(getPersonalStorageSnapshot().movies).toEqual({});

      unsubscribe();
    });

    it("existing same-tab custom-event (PERSONAL_UPDATE_EVENT) synchronization remains correct", () => {
      const listener = vi.fn();
      const unsubscribe = subscribePersonalStorage(listener);
      listener.mockClear();

      const state = toggleFavoriteInStore(getInitialPersonalState(), "movie-custom-event", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(state));

      window.dispatchEvent(
        new CustomEvent(PERSONAL_UPDATE_EVENT, { detail: state })
      );

      expect(listener).toHaveBeenCalled();
      expect(getPersonalStorageSnapshot().movies["movie-custom-event"]?.isFavorite).toBe(true);

      unsubscribe();
    });

    it("simulated cross-tab ping-pong confirms zero event feedback loop", () => {
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      // Simulate Tab A and Tab B listeners
      const tabAListener = vi.fn();
      const tabBListener = vi.fn();

      const unsubA = subscribePersonalStorage(tabAListener);
      const unsubB = subscribePersonalStorage(tabBListener);

      tabAListener.mockClear();
      tabBListener.mockClear();
      setItemSpy.mockClear();

      // Tab A writes probe key
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_PROBE_KEY,
          newValue: "1",
        })
      );

      // Both listeners ignore the probe key completely
      expect(tabAListener).not.toHaveBeenCalled();
      expect(tabBListener).not.toHaveBeenCalled();
      expect(setItemSpy).not.toHaveBeenCalled();

      unsubA();
      unsubB();
    });
  });

  describe("Subscriber Notification Deduplication (Phase 6.11.1)", () => {
    it("notifies subscribers exactly once on a successful write when availability is already true", () => {
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      expect(isPersonalStorageAvailable()).toBe(true);
      listener.mockClear();

      const state = toggleFavoriteInStore(getInitialPersonalState(), "m-dedup-1", mockSnapshot);
      const ok = writePersonalStorage(state);

      expect(ok).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });

    it("notifies subscribers exactly once on a failed write when availability is true", () => {
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      expect(isPersonalStorageAvailable()).toBe(true);
      listener.mockClear();

      const quotaFailingStorage = {
        ...storageInterface,
        setItem: () => {
          const err = new Error("QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        },
      } as Storage;

      const state = toggleFavoriteInStore(getInitialPersonalState(), "m-dedup-2", mockSnapshot);
      const ok = writePersonalStorage(state, quotaFailingStorage);

      expect(ok).toBe(false);
      expect(isPersonalStorageAvailable()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });

    it("notifies subscribers exactly once on a failed write when availability is already false", () => {
      // 1. Subscribe while normal localStorage is available
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      expect(isPersonalStorageAvailable()).toBe(true);

      // 2. Explicitly transition availability to false after subscription
      setPersonalStorageAvailable(false);
      // Ensure the intended initial state is asserted immediately before the write
      expect(isPersonalStorageAvailable()).toBe(false);

      // 3. Clear listener mock
      listener.mockClear();

      // 4. Call writePersonalStorage while availability is genuinely false
      const state = toggleFavoriteInStore(getInitialPersonalState(), "m-dedup-3", mockSnapshot);
      const ok = writePersonalStorage(state, null);

      // 5. Verify availability remains false and subscriber is notified exactly once
      expect(ok).toBe(false);
      expect(isPersonalStorageAvailable()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });

    it("notifies subscribers exactly once on a successful write after availability was false", () => {
      // Force availability to false first
      setPersonalStorageAvailable(false);
      expect(isPersonalStorageAvailable()).toBe(false);

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      const state = toggleFavoriteInStore(getInitialPersonalState(), "m-dedup-4", mockSnapshot);
      const ok = writePersonalStorage(state);

      expect(ok).toBe(true);
      expect(isPersonalStorageAvailable()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });

    it("notifies subscribers exactly once on a direct availability transition with no data write", () => {
      expect(isPersonalStorageAvailable()).toBe(true);

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // Transition true -> false
      setPersonalStorageAvailable(false);
      expect(listener).toHaveBeenCalledTimes(1);
      listener.mockClear();

      // Calling again with false does NOT notify (no transition)
      setPersonalStorageAvailable(false);
      expect(listener).not.toHaveBeenCalled();

      // Transition false -> true
      setPersonalStorageAvailable(true);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });
  });

  describe("Session-Only Data Preservation on Storage Read Failure (Phase 6.11.1)", () => {
    it("preserves in-memory favorite when relevant storage event arrives and window.localStorage getter throws", () => {
      const stateWithMovie = toggleFavoriteInStore(getInitialPersonalState(), "session-movie-1", mockSnapshot);
      writePersonalStorage(stateWithMovie);
      expect(getPersonalStorageSnapshot().movies["session-movie-1"]?.isFavorite).toBe(true);

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      const originalGetter = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      });

      try {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: PERSONAL_STORAGE_KEY,
            newValue: null,
          })
        );

        // In-memory favorite MUST be preserved
        expect(getPersonalStorageSnapshot().movies["session-movie-1"]?.isFavorite).toBe(true);
        expect(isPersonalStorageAvailable()).toBe(false);
        expect(listener).toHaveBeenCalled();
      } finally {
        if (originalGetter) {
          Object.defineProperty(window, "localStorage", originalGetter);
        }
        unsub();
      }
    });

    it("preserves in-memory favorite when relevant storage event arrives and getItem throws", () => {
      const stateWithMovie = toggleFavoriteInStore(getInitialPersonalState(), "session-movie-2", mockSnapshot);
      writePersonalStorage(stateWithMovie);
      expect(getPersonalStorageSnapshot().movies["session-movie-2"]?.isFavorite).toBe(true);

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Disk I/O failure");
      });

      try {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: PERSONAL_STORAGE_KEY,
            newValue: '{"version":1,"movies":{}}',
          })
        );

        expect(getPersonalStorageSnapshot().movies["session-movie-2"]?.isFavorite).toBe(true);
        expect(isPersonalStorageAvailable()).toBe(false);
      } finally {
        getItemSpy.mockRestore();
        unsub();
      }
    });

    it("replaces cached snapshot on valid cross-tab update when storage read succeeds", () => {
      const stateTab1 = toggleFavoriteInStore(getInitialPersonalState(), "local-tab-movie", mockSnapshot);
      writePersonalStorage(stateTab1);

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      const stateTab2 = toggleFavoriteInStore(getInitialPersonalState(), "remote-tab-movie", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(stateTab2));

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(stateTab2),
        })
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(getPersonalStorageSnapshot().movies["remote-tab-movie"]?.isFavorite).toBe(true);
      expect(getPersonalStorageSnapshot().movies["local-tab-movie"]).toBeUndefined();

      unsub();
    });

    it("clears personal state when a genuine localStorage.clear() event occurs and storage is accessible", () => {
      const stateWithMovie = toggleFavoriteInStore(getInitialPersonalState(), "movie-to-wipe", mockSnapshot);
      writePersonalStorage(stateWithMovie);
      expect(getPersonalStorageSnapshot().movies["movie-to-wipe"]).toBeDefined();

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      window.localStorage.clear();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
        })
      );

      expect(listener).toHaveBeenCalled();
      expect(getPersonalStorageSnapshot().movies).toEqual({});
      expect(isPersonalStorageAvailable()).toBe(true);

      unsub();
    });

    it("safeReadPersonalStorage returns structured result distinguishing inaccessibility from empty/corrupt state", () => {
      expect(safeReadPersonalStorage(null)).toEqual({
        success: false,
        reason: "inaccessible",
      });

      const failingStorage = {
        ...storageInterface,
        getItem: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      } as Storage;
      expect(safeReadPersonalStorage(failingStorage)).toEqual({
        success: false,
        reason: "inaccessible",
      });

      const emptyStorage = {
        ...storageInterface,
        getItem: () => null,
      } as Storage;
      expect(safeReadPersonalStorage(emptyStorage)).toEqual({
        success: true,
        data: getInitialPersonalState(),
      });

      const corruptStorage = {
        ...storageInterface,
        getItem: () => "{ corrupt json syntax",
      } as Storage;
      expect(safeReadPersonalStorage(corruptStorage)).toEqual({
        success: false,
        reason: "corrupt",
      });

      const unsupportedVersionStorage = {
        ...storageInterface,
        getItem: () => JSON.stringify({ version: 2, movies: {} }),
      } as Storage;
      expect(safeReadPersonalStorage(unsupportedVersionStorage)).toEqual({
        success: false,
        reason: "unsupported_version",
      });
    });
  });

  describe("Cache Reset & Listener Lifecycle (Phase 6.11.1)", () => {
    it("resetPersonalStorageCache() unregisters window listeners and clears subscribers without stale callbacks", () => {
      const listener = vi.fn();
      subscribePersonalStorage(listener);

      setPersonalStorageAvailable(false);
      expect(listener).toHaveBeenCalledTimes(1);
      listener.mockClear();

      resetPersonalStorageCache();

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: "{}",
        })
      );
      window.dispatchEvent(
        new CustomEvent(PERSONAL_UPDATE_EVENT, { detail: INITIAL_PERSONAL_STATE })
      );

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("Strict Snapshot Purity & Storage Recovery (Phase 6.11.2)", () => {
    it("regression: getPersonalStorageSnapshot is strictly pure and does not trigger notifications or availability changes", () => {
      // 1. Reset storage cache while normal localStorage is available
      resetPersonalStorageCache();
      expect(isPersonalStorageAvailable()).toBe(true);

      // 2. Subscribe a test listener
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // 3. Ensure the personal snapshot cache is uninitialized (cachedSnapshot is null)
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
      setItemSpy.mockClear();

      // 4. Replace window.localStorage with a getter that throws SecurityError
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      });

      try {
        // 5. Call getPersonalStorageSnapshot() repeatedly
        const snap1 = getPersonalStorageSnapshot();
        const snap2 = getPersonalStorageSnapshot();

        // 6. Assert:
        // - No subscriber notification occurs
        expect(listener).not.toHaveBeenCalled();
        // - isPersonalStorageAvailable() does not change merely because the snapshot was read
        expect(isPersonalStorageAvailable()).toBe(true);
        // - No storage probe or write occurs
        expect(setItemSpy).not.toHaveBeenCalled();
        // - The returned snapshot is stable
        expect(snap1).toBe(snap2);
        expect(snap1).toEqual(getInitialPersonalState());
      } finally {
        // 7. Restore the original localStorage property
        if (originalDescriptor) {
          Object.defineProperty(window, "localStorage", originalDescriptor);
        }
      }

      // 8. Call the explicit availability-check lifecycle function
      const failingStorage = {
        ...storageInterface,
        setItem: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      } as Storage;

      checkPersonalStorageAvailability(failingStorage);

      // 9. Verify availability changes and subscribers are notified through that explicit path
      expect(isPersonalStorageAvailable()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
      listener.mockClear();

      checkPersonalStorageAvailability();
      expect(isPersonalStorageAvailable()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);

      unsub();
    });

    it("recovery policy: loads valid persisted data on storage recovery when no session mutations occurred", () => {
      // 1. Pre-populate persisted data in localStorage
      const persistedState = toggleFavoriteInStore(getInitialPersonalState(), "persisted-movie-1", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(persistedState));

      // 2. Storage starts unavailable
      resetPersonalStorageCache();

      const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      });

      const listener = vi.fn();
      let unsub: () => void;
      try {
        unsub = subscribePersonalStorage(listener);
        expect(isPersonalStorageAvailable()).toBe(false);

        // Snapshot is read while storage is unavailable (returns initial empty state, no session mutations)
        const initialSnap = getPersonalStorageSnapshot();
        expect(initialSnap).toEqual(INITIAL_PERSONAL_STATE);
        expect(Object.keys(initialSnap.movies).length).toBe(0);

        listener.mockClear();
      } finally {
        // 3. Storage recovers: restore real localStorage
        if (originalDescriptor) {
          Object.defineProperty(window, "localStorage", originalDescriptor);
        }
      }

      // Explicit check detects recovery
      const recovered = checkPersonalStorageAvailability();
      expect(recovered).toBe(true);
      expect(isPersonalStorageAvailable()).toBe(true);

      // Persisted data is loaded into the snapshot!
      expect(getPersonalStorageSnapshot().movies["persisted-movie-1"]?.isFavorite).toBe(true);

      // Exactly one notification fired for recovery
      expect(listener).toHaveBeenCalledTimes(1);

      unsub!();
    });

    it("recovery policy: preserves session-only mutations and does not overwrite them with storage data upon recovery", () => {
      // 1. Storage has older movie on disk
      const persistedState = toggleFavoriteInStore(getInitialPersonalState(), "disk-movie", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(persistedState));

      // 2. Storage becomes unavailable
      resetPersonalStorageCache();

      const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      });

      const listener = vi.fn();
      let unsub: () => void;
      try {
        unsub = subscribePersonalStorage(listener);
        expect(isPersonalStorageAvailable()).toBe(false);

        // User performs in-memory session mutation while storage is unavailable
        const sessionState = toggleFavoriteInStore(getInitialPersonalState(), "session-movie", mockSnapshot);
        const writeOk = writePersonalStorage(sessionState);
        expect(writeOk).toBe(false);
        expect(getPersonalStorageSnapshot().movies["session-movie"]?.isFavorite).toBe(true);

        listener.mockClear();
      } finally {
        // 3. Storage becomes accessible again: restore real localStorage
        if (originalDescriptor) {
          Object.defineProperty(window, "localStorage", originalDescriptor);
        }
      }

      // Explicit check detects recovery
      const recovered = checkPersonalStorageAvailability();
      expect(recovered).toBe(true);
      expect(isPersonalStorageAvailable()).toBe(true);

      // Session-only data (session-movie) MUST be preserved, and remote/persisted data is merged!
      const currentSnapshot = getPersonalStorageSnapshot();
      expect(currentSnapshot.movies["session-movie"]?.isFavorite).toBe(true);
      expect(currentSnapshot.movies["disk-movie"]?.isFavorite).toBe(true);

      // Single notification for availability transition
      expect(listener).toHaveBeenCalledTimes(1);

      unsub!();
    });

    it("recovery policy: does not trigger duplicate notifications when persisted data matches cached snapshot", () => {
      const persistedState = toggleFavoriteInStore(getInitialPersonalState(), "same-movie", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(persistedState));

      resetPersonalStorageCache();
      // Load snapshot while storage is available
      getPersonalStorageSnapshot();

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // Running availability check when already available and snapshot matches: 0 notifications
      checkPersonalStorageAvailability();
      expect(listener).not.toHaveBeenCalled();

      unsub();
    });
  });

  describe("Session Mutation Conflict Protection & Recovery Completeness (Phase 6.11.3)", () => {
    it("session-only favorite survives a remote storage update and pending mutation flag is retained", () => {
      resetPersonalStorageCache();
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // 1. Storage write fails (e.g. storage null / offline)
      const sessionState = toggleFavoriteInStore(getInitialPersonalState(), "session-movie-conflict", mockSnapshot);
      const ok = writePersonalStorage(sessionState, null);
      expect(ok).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getPersonalStorageSnapshot().movies["session-movie-conflict"]?.isFavorite).toBe(true);

      // 2. Storage becomes accessible again in background.
      // Remote tab writes another movie to localStorage and dispatches storage event
      const remoteMovie: MovieSnapshot = {
        ...mockSnapshot,
        id: "remote-movie-1",
        title: "Remote Film",
      };
      const remoteState = toggleFavoriteInStore(getInitialPersonalState(), "remote-movie-1", remoteMovie);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState));

      // Dispatch remote storage event
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState),
        })
      );

      // 3. Verify session favorite survived AND remote movie was merged!
      const currentSnapshot = getPersonalStorageSnapshot();
      expect(currentSnapshot.movies["session-movie-conflict"]?.isFavorite).toBe(true);
      expect(currentSnapshot.movies["remote-movie-1"]?.isFavorite).toBe(true);

      // 4. Verify session-mutation flag was NOT cleared by the remote event
      expect(hasPersonalSessionMutations()).toBe(true);

      // 5. Subsequent successful local write persists the preserved merged state and clears pending mutation flag
      const writeOk = writePersonalStorage(currentSnapshot);
      expect(writeOk).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(false);

      // Verify localStorage on disk now has both movies
      const stored = JSON.parse(window.localStorage.getItem(PERSONAL_STORAGE_KEY) || "{}");
      expect(stored.movies["session-movie-conflict"]?.isFavorite).toBe(true);
      expect(stored.movies["remote-movie-1"]?.isFavorite).toBe(true);

      unsub();
    });

    it("remote localStorage.clear() event does not discard local pending session mutations", () => {
      resetPersonalStorageCache();
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // Create session-only favorite
      const sessionState = toggleFavoriteInStore(getInitialPersonalState(), "session-movie-clear", mockSnapshot);
      writePersonalStorage(sessionState, null);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getPersonalStorageSnapshot().movies["session-movie-clear"]?.isFavorite).toBe(true);

      // Remote tab clears storage
      window.localStorage.clear();
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
        })
      );

      // Session mutation survives!
      expect(getPersonalStorageSnapshot().movies["session-movie-clear"]?.isFavorite).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(true);

      unsub();
    });

    it("normal cross-tab updates and clear events replace cached snapshot when no session mutations are pending", () => {
      resetPersonalStorageCache();
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      expect(hasPersonalSessionMutations()).toBe(false);

      // Remote tab updates storage
      const remoteState = toggleFavoriteInStore(getInitialPersonalState(), "normal-remote-movie", mockSnapshot);
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState),
        })
      );

      expect(getPersonalStorageSnapshot().movies["normal-remote-movie"]?.isFavorite).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(false);

      // Remote tab clears storage
      window.localStorage.clear();
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
        })
      );

      expect(getPersonalStorageSnapshot().movies).toEqual({});
      expect(hasPersonalSessionMutations()).toBe(false);

      unsub();
    });

    it("recovery detection restores persisted profile-only data when cached snapshot is empty", () => {
      // 1. Initialize cached empty snapshot while storage is inaccessible
      resetPersonalStorageCache();

      const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => {
          throw new DOMException("Access denied", "SecurityError");
        },
      });

      const listener = vi.fn();
      let unsub: () => void;
      try {
        unsub = subscribePersonalStorage(listener);
        expect(isPersonalStorageAvailable()).toBe(false);

        // Read snapshot while storage is inaccessible
        const initialSnap = getPersonalStorageSnapshot();
        expect(initialSnap.profile).toBeUndefined();
        expect(Object.keys(initialSnap.movies).length).toBe(0);

        listener.mockClear();
      } finally {
        // Restore localStorage
        if (originalDescriptor) {
          Object.defineProperty(window, "localStorage", originalDescriptor);
        }
      }

      // 2. Restore storage containing profile information but NO movies
      const profileOnlyState: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: {
          displayName: "Curator Alpha",
          bio: "Archivist and film historian",
        },
      };
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(profileOnlyState));

      // 3. Run checkPersonalStorageAvailability()
      const recovered = checkPersonalStorageAvailability();
      expect(recovered).toBe(true);
      expect(isPersonalStorageAvailable()).toBe(true);

      // 4. Verify persisted profile becomes visible in getPersonalStorageSnapshot()
      const currentSnap = getPersonalStorageSnapshot();
      expect(currentSnap.profile?.displayName).toBe("Curator Alpha");
      expect(currentSnap.profile?.bio).toBe("Archivist and film historian");
      expect(Object.keys(currentSnap.movies).length).toBe(0);

      // 5. Verify exactly one appropriate notification
      expect(listener).toHaveBeenCalledTimes(1);

      unsub!();
    });

    it("hasPersonalData helper accurately classifies states as having or lacking meaningful user data", () => {
      expect(hasPersonalData(null)).toBe(false);
      expect(hasPersonalData(undefined)).toBe(false);
      expect(hasPersonalData({ version: 1, movies: {} })).toBe(false);
      expect(hasPersonalData({ version: 1, movies: {}, profile: { displayName: "", bio: "" } })).toBe(false);
      expect(hasPersonalData({ version: 1, movies: {}, profile: { displayName: "   ", bio: "\n" } })).toBe(false);
      expect(hasPersonalData({ version: 1, movies: {}, profile: { displayName: "User", bio: "" } })).toBe(true);
      expect(hasPersonalData({ version: 1, movies: {}, profile: { displayName: "", bio: "Bio info" } })).toBe(true);

      const stateWithMovie = toggleFavoriteInStore(getInitialPersonalState(), "m-has-data", mockSnapshot);
      expect(hasPersonalData(stateWithMovie)).toBe(true);
    });

    it("mergePersonalStates cleanly combines movie records, ratings, and comments", () => {
      const stateA: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          "m-a": {
            id: "m-a",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: "watchlist",
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const stateB: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          "m-b": {
            id: "m-b",
            snapshot: mockSnapshot,
            isFavorite: false,
            listStatus: "watched",
            personalRating: 9,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      const merged = mergePersonalStates(stateA, stateB);
      expect(merged.movies["m-a"]?.isFavorite).toBe(true);
      expect(merged.movies["m-b"]?.listStatus).toBe("watched");
      expect(merged.movies["m-b"]?.personalRating).toBe(9);
    });
  });

  describe("Three-Way Conflict Resolution & Deletion Safety (Phase 6.11.4)", () => {
    it("Test 1: Local favorite addition + remote unrelated change merges cleanly", () => {
      const base = getInitialPersonalState();
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m2: {
            id: "m2",
            snapshot: { ...mockSnapshot, id: "m2", title: "Remote Movie" },
            isFavorite: false,
            listStatus: "watchlist",
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T01:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.isFavorite).toBe(true);
      expect(merged.movies["m2"]?.listStatus).toBe("watchlist");
    });

    it("Test 2: Local favorite removal + stale remote favorite (deletion preserved, does not resurrect)", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      // Remote is stale (still has favorite: true)
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      // Local removed favorite (record is pruned because all fields are empty)
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      // m1 must NOT be resurrected by stale remote
      expect(merged.movies["m1"]).toBeUndefined();
    });

    it("Test 3: Remote favorite addition + unchanged Local value (accepted)", () => {
      const base = getInitialPersonalState();
      const local = getInitialPersonalState();
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.isFavorite).toBe(true);
    });

    it("Test 4: Local rating change + older remote rating (local wins)", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 5,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 7,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 9.5,
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.personalRating).toBe(9.5);
    });

    it("Test 5: Local rating clear + stale remote rating (clearing preserved)", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 8,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      // Remote is stale (still has rating 8)
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      // Local cleared rating to null while keeping favorite
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: null,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.isFavorite).toBe(true);
      expect(merged.movies["m1"]?.personalRating).toBeNull();
    });

    it("Test 6: Concurrent rating changes with deterministic conflict resolution", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 5,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };

      // Case A: Remote changed, Local unchanged from Base -> Remote rating wins
      const remoteChanged: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 8.5,
            updatedAt: "2026-01-05T00:00:00.000Z",
          },
        },
      };
      const localUnchanged: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      expect(threeWayMergePersonalStates(base, localUnchanged, remoteChanged).movies["m1"]?.personalRating).toBe(8.5);

      // Case B: Local changed, Remote unchanged from Base -> Local rating wins
      const localChanged: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 10,
            updatedAt: "2026-01-06T00:00:00.000Z",
          },
        },
      };
      const remoteUnchanged: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      expect(threeWayMergePersonalStates(base, localChanged, remoteUnchanged).movies["m1"]?.personalRating).toBe(10);

      // Case C: Both changed differently (even if Remote has newer updatedAt) -> deterministic Local-wins policy
      const remoteNewerConflicting: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 8.5,
            updatedAt: "2026-01-10T00:00:00.000Z", // Remote timestamp is newer
          },
        },
      };
      const localConflicting: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 6.0,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      // Local wins despite Remote having newer record-wide timestamp
      expect(threeWayMergePersonalStates(base, localConflicting, remoteNewerConflicting).movies["m1"]?.personalRating).toBe(6.0);

      // Case D: Both changed to the exact same value -> that value is retained
      const remoteSame: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 7.5,
            updatedAt: "2026-01-08T00:00:00.000Z",
          },
        },
      };
      const localSame: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 7.5,
            updatedAt: "2026-01-04T00:00:00.000Z",
          },
        },
      };
      expect(threeWayMergePersonalStates(base, localSame, remoteSame).movies["m1"]?.personalRating).toBe(7.5);
    });

    it("Test 7: Local comment deletion + stale remote copy (comment deleted)", () => {
      const comment1: PersonalComment = { id: "c1", text: "Original", createdAt: "2026-01-01T00:00:00.000Z" };
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [comment1],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.comments).toBeUndefined();
    });

    it("Test 8: Remote comment deletion + unchanged Local copy (comment deleted)", () => {
      const comment1: PersonalComment = { id: "c1", text: "Original", createdAt: "2026-01-01T00:00:00.000Z" };
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [comment1],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.comments).toBeUndefined();
    });

    it("Test 9: Independent comments added by both sides (both preserved, sorted)", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const cLocal: PersonalComment = { id: "c-loc", text: "Local comment", createdAt: "2026-01-02T12:00:00.000Z" };
      const cRemote: PersonalComment = { id: "c-rem", text: "Remote comment", createdAt: "2026-01-02T10:00:00.000Z" };

      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [cLocal],
            updatedAt: "2026-01-02T12:00:00.000Z",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [cRemote],
            updatedAt: "2026-01-02T10:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.comments).toHaveLength(2);
      expect(merged.movies["m1"]?.comments?.[0]?.id).toBe("c-rem");
      expect(merged.movies["m1"]?.comments?.[1]?.id).toBe("c-loc");
    });

    it("Test 10: Local display-name update + remote bio update (both fields merged)", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: { displayName: "Alice", bio: "Original bio" },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: { displayName: "Alice Updated", bio: "Original bio" },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: { displayName: "Alice", bio: "Remote bio update" },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.profile?.displayName).toBe("Alice Updated");
      expect(merged.profile?.bio).toBe("Remote bio update");
    });

    it("Test 11: Local profile-field clearing + stale remote profile (clearing preserved)", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: { displayName: "Alice", bio: "Original bio" },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: { displayName: "Alice", bio: "Original bio" },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
        profile: { displayName: "Alice", bio: "" },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.profile?.displayName).toBe("Alice");
      expect(merged.profile?.bio).toBe("");
    });

    it("Test 12: Local watchlist/watched transition + stale remote status", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: false,
            listStatus: "watchlist",
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            listStatus: "watched",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.listStatus).toBe("watched");
    });

    it("Test 13: Remote localStorage.clear() with pending local edits (untouched base records removed, local edits and additions preserved, hasSessionMutations retained)", () => {
      resetPersonalStorageCache();
      localStorage.clear();

      // Seed storage with base data: m1 (will be untouched) and m2 (will be edited)
      const initialStoredState: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          m2: {
            id: "m2",
            snapshot: { ...mockSnapshot, id: "m2", title: "Movie 2" },
            isFavorite: true,
            listStatus: null,
            personalRating: 5,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(initialStoredState));

      // Subscribe to attach listeners and establish baseline
      const unsubscribe = subscribePersonalStorage(() => {});

      // Simulate storage becoming unavailable (setItem throws)
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      // Local edit: edit m2 to rating 10
      let localState = getPersonalStorageSnapshot();
      localState = setPersonalRatingInStore(localState, "m2", mockSnapshot, 10);
      // Local addition: add m3
      localState = toggleFavoriteInStore(localState, "m3", { ...mockSnapshot, id: "m3", title: "Movie 3" });
      writePersonalStorage(localState);

      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getSessionBaseSnapshot()).not.toBeNull();

      // Remote clears storage!
      localStorage.clear();
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
          newValue: null,
          oldValue: null,
          storageArea: localStorage,
        })
      );

      const postClearSnapshot = getPersonalStorageSnapshot();

      // m1 was untouched in Local -> pruned/removed
      expect(postClearSnapshot.movies["m1"]).toBeUndefined();
      // m2 was edited in Local -> preserved with rating 10
      expect(postClearSnapshot.movies["m2"]?.personalRating).toBe(10);
      // m3 was added in Local -> preserved with favorite
      expect(postClearSnapshot.movies["m3"]?.isFavorite).toBe(true);
      // Unsaved mutation flag is retained
      expect(hasPersonalSessionMutations()).toBe(true);

      setItemSpy.mockRestore();
      unsubscribe();
    });

    it("Test 14: Successful persistence of merged result clears Base and mutation flag", () => {
      resetPersonalStorageCache();
      localStorage.clear();

      const unsubscribe = subscribePersonalStorage(() => {});

      // Simulate failed write
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      let state = getPersonalStorageSnapshot();
      state = toggleFavoriteInStore(state, "m1", mockSnapshot);
      writePersonalStorage(state);

      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getSessionBaseSnapshot()).not.toBeNull();

      // Storage recovers
      setItemSpy.mockRestore();

      const persistSuccess = writePersonalStorage(getPersonalStorageSnapshot());
      expect(persistSuccess).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(false);
      expect(getSessionBaseSnapshot()).toBeNull();

      unsubscribe();
    });

    it("Test 15: Multiple incoming remote events continue using the same original Base", () => {
      resetPersonalStorageCache();
      localStorage.clear();

      // Seed storage with m1
      const initialStoredState: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 5,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(initialStoredState));

      const unsubscribe = subscribePersonalStorage(() => {});

      // Simulate failed write: edit m1 rating to 9
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Disk full");
      });

      let localState = getPersonalStorageSnapshot();
      localState = setPersonalRatingInStore(localState, "m1", mockSnapshot, 9);
      writePersonalStorage(localState);

      const capturedBase = getSessionBaseSnapshot();
      expect(capturedBase?.movies["m1"]?.personalRating).toBe(5);

      // Restore setItem so we can simulate another tab writing to localStorage
      setItemSpy.mockRestore();

      // Event 1: remote adds m2
      const remoteState1: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          ...initialStoredState.movies,
          m2: {
            id: "m2",
            snapshot: { ...mockSnapshot, id: "m2" },
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState1));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState1),
          storageArea: localStorage,
        })
      );

      // sessionBaseSnapshot must remain identical to capturedBase
      expect(getSessionBaseSnapshot()).toBe(capturedBase);
      expect(getPersonalStorageSnapshot().movies["m1"]?.personalRating).toBe(9);
      expect(getPersonalStorageSnapshot().movies["m2"]?.isFavorite).toBe(true);

      // Event 2: remote marks m2 as watched
      const remoteState2: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          ...remoteState1.movies,
          m2: {
            ...remoteState1.movies["m2"]!,
            listStatus: "watched",
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState2));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState2),
          storageArea: localStorage,
        })
      );

      // Base is STILL the original captured base
      expect(getSessionBaseSnapshot()).toBe(capturedBase);
      // Pending local mutation (rating 9) is still preserved!
      expect(getPersonalStorageSnapshot().movies["m1"]?.personalRating).toBe(9);
      // And remote changes are merged
      expect(getPersonalStorageSnapshot().movies["m2"]?.listStatus).toBe("watched");

      unsubscribe();
    });

    it("Test 16: Repeated merging of unchanged Base/Local/Remote inputs produces deterministic results", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: "watchlist",
            personalRating: 8,
            comments: [{ id: "c1", text: "Classic", createdAt: "2026-01-01T00:00:00.000Z" }],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
        profile: { displayName: "FilmFan", bio: "Bio" },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 9.5,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
        profile: { displayName: "FilmFan Updated", bio: "Bio" },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [
              { id: "c1", text: "Classic", createdAt: "2026-01-01T00:00:00.000Z" },
              { id: "c2", text: "Added", createdAt: "2026-01-03T00:00:00.000Z" },
            ],
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
        },
        profile: { displayName: "FilmFan", bio: "Bio Updated" },
      };

      const result1 = threeWayMergePersonalStates(base, local, remote);
      const result2 = threeWayMergePersonalStates(base, local, remote);
      expect(result1).toEqual(result2);
    });

    it("areRecordsEqual accurately compares records across all fields", () => {
      const recA: PersonalRecord = {
        id: "m1",
        snapshot: mockSnapshot,
        isFavorite: true,
        listStatus: "watchlist",
        personalRating: 8,
        comments: [{ id: "c1", text: "Good", createdAt: "2026-01-01T00:00:00.000Z" }],
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      expect(areRecordsEqual(recA, recA)).toBe(true);
      expect(areRecordsEqual(recA, { ...recA })).toBe(true);
      expect(areRecordsEqual(recA, { ...recA, id: "m2" })).toBe(false);
      expect(areRecordsEqual(recA, { ...recA, isFavorite: false })).toBe(false);
      expect(areRecordsEqual(recA, { ...recA, listStatus: "watched" })).toBe(false);
      expect(areRecordsEqual(recA, { ...recA, personalRating: 9 })).toBe(false);
      expect(areRecordsEqual(recA, { ...recA, comments: [] })).toBe(false);
      expect(
        areRecordsEqual(recA, {
          ...recA,
          comments: [{ id: "c1", text: "Edited text", createdAt: "2026-01-01T00:00:00.000Z" }],
        })
      ).toBe(false);
    });
  });

  describe("Phase 6.11.5 — Multi-Event Merge Stability & Field-Level Conflict Hardening", () => {
    it("Section 1: Multi-event merge does not mistake previously accepted remote changes for local edits", () => {
      resetPersonalStorageCache();
      localStorage.clear();

      const baseState: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: false,
            listStatus: null,
            personalRating: 8,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(baseState));

      const unsubscribe = subscribePersonalStorage(() => {});

      // Simulate storage becoming unavailable
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Disk full");
      });

      // Local mutation on m_local (m1 is NOT modified by local!)
      let localState = getPersonalStorageSnapshot();
      localState = toggleFavoriteInStore(localState, "m_local", { ...mockSnapshot, id: "m_local" });
      writePersonalStorage(localState);

      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getSessionBaseSnapshot()).not.toBeNull();
      expect(getLatestRemoteSnapshot()).not.toBeNull();

      setItemSpy.mockRestore();

      // Remote Event 1: Remote changes m1 favorite to true
      const remoteState1: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...baseState.movies["m1"]!,
            isFavorite: true,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState1));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState1),
          storageArea: localStorage,
        })
      );

      // Verify Event 1 accepted: m1 is true, local m_local is true
      expect(getPersonalStorageSnapshot().movies["m1"]?.isFavorite).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
      expect(getLatestRemoteSnapshot()?.movies["m1"]?.isFavorite).toBe(true);

      // Remote Event 2: Remote changes m1 favorite back to false
      const remoteState2: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...remoteState1.movies["m1"]!,
            isFavorite: false,
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState2));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState2),
          storageArea: localStorage,
        })
      );

      // Critical assertion: m1 must NOT be retained as true! Remote 2's false must be accepted!
      expect(getPersonalStorageSnapshot().movies["m1"]?.isFavorite).toBe(false);
      // Local pending mutation on m_local is STILL preserved!
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(true);

      unsubscribe();
    });

    it("Section 2: A Remote comment update does not make an unrelated Remote rating appear newer", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 7,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      // Local updated rating from 7 to 9
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 9,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      // Remote did NOT touch rating (still 7), but added a comment with a newer updatedAt
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 7,
            comments: [{ id: "c1", text: "New comment", createdAt: "2026-01-05T00:00:00.000Z" }],
            updatedAt: "2026-01-05T00:00:00.000Z", // Much newer timestamp
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      // Local rating 9 MUST win because Local changed rating from Base while Remote did not!
      expect(merged.movies["m1"]?.personalRating).toBe(9);
      // Remote comment is also accepted cleanly
      expect(merged.movies["m1"]?.comments).toHaveLength(1);
    });

    it("Section 2: Local rating wins simultaneous conflicting Remote rating under Local-wins policy", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 5,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 9,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 8,
            updatedAt: "2026-01-04T00:00:00.000Z", // Even if remote timestamp is newer
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.personalRating).toBe(9);
    });

    it("Section 2: Remote rating wins when Local rating is unchanged from Base", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 5,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: { ...base.movies["m1"]! },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 8.5,
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const merged = threeWayMergePersonalStates(base, local, remote);
      expect(merged.movies["m1"]?.personalRating).toBe(8.5);
    });

    it("Section 2: Local and Remote rating clearing behavior remains correct", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: 8,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };

      // Case 1: Local clears to null, Remote unchanged -> null
      const localCleared: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, personalRating: null } },
      };
      expect(threeWayMergePersonalStates(base, localCleared, base).movies["m1"]?.personalRating).toBeNull();

      // Case 2: Remote clears to null, Local unchanged -> null
      const remoteCleared: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, personalRating: null } },
      };
      expect(threeWayMergePersonalStates(base, base, remoteCleared).movies["m1"]?.personalRating).toBeNull();

      // Case 3: Local changes to 9, Remote clears to null -> Local wins (9)
      const localChanged: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, personalRating: 9 } },
      };
      expect(threeWayMergePersonalStates(base, localChanged, remoteCleared).movies["m1"]?.personalRating).toBe(9);

      // Case 4: Remote changes to 9, Local clears to null -> Local wins (null)
      const remoteChanged: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, personalRating: 9 } },
      };
      expect(threeWayMergePersonalStates(base, localCleared, remoteChanged).movies["m1"]?.personalRating).toBeNull();
    });

    it("Section 2: Watchlist/Watched conflicts use reliable three-way field comparison", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: "watchlist",
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };

      // Local transitions to watched, Remote unchanged -> watched
      const localWatched: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, listStatus: "watched" } },
      };
      expect(threeWayMergePersonalStates(base, localWatched, base).movies["m1"]?.listStatus).toBe("watched");

      // Remote transitions to watched, Local unchanged -> watched
      const remoteWatched: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, listStatus: "watched" } },
      };
      expect(threeWayMergePersonalStates(base, base, remoteWatched).movies["m1"]?.listStatus).toBe("watched");

      // Conflicting transitions: Local clears to null, Remote transitions to watched -> Local wins (null)
      const localCleared: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, listStatus: null } },
      };
      expect(threeWayMergePersonalStates(base, localCleared, remoteWatched).movies["m1"]?.listStatus).toBeNull();

      // Unrelated field (comment) bumping Remote updatedAt cannot override Local status change
      const remoteCommentBump: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [{ id: "c1", text: "Comment", createdAt: "2026-01-10T00:00:00.000Z" }],
            updatedAt: "2026-01-10T00:00:00.000Z",
          },
        },
      };
      expect(threeWayMergePersonalStates(base, localWatched, remoteCommentBump).movies["m1"]?.listStatus).toBe("watched");
    });

    it("Section 3: Comment deletion-versus-edit combinations", () => {
      const comment1: PersonalComment = { id: "c1", text: "Base comment", createdAt: "2026-01-01T00:00:00.000Z" };
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [comment1],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      };

      // Combination 1: Local deletes while Remote is unchanged -> comment deleted
      const localDelete: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, comments: [] } },
      };
      expect(threeWayMergePersonalStates(base, localDelete, base).movies["m1"]?.comments).toBeUndefined();

      // Combination 2: Remote deletes while Local is unchanged -> comment deleted
      const remoteDelete: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, comments: [] } },
      };
      expect(threeWayMergePersonalStates(base, base, remoteDelete).movies["m1"]?.comments).toBeUndefined();

      // Combination 3: Local deletes while Remote edits -> Local deletion wins (Local-wins rule)
      const remoteEdit: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [{ id: "c1", text: "Remote edited text", createdAt: "2026-01-01T00:00:00.000Z" }],
          },
        },
      };
      expect(threeWayMergePersonalStates(base, localDelete, remoteEdit).movies["m1"]?.comments).toBeUndefined();

      // Combination 4: Remote deletes while Local edits -> preserve Local edit!
      const localEdit: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [{ id: "c1", text: "Local edited text", createdAt: "2026-01-01T00:00:00.000Z" }],
          },
        },
      };
      const preservedLocalEdit = threeWayMergePersonalStates(base, localEdit, remoteDelete).movies["m1"]?.comments;
      expect(preservedLocalEdit).toHaveLength(1);
      expect(preservedLocalEdit?.[0]?.text).toBe("Local edited text");

      // Combination 5: Both delete -> comment deleted
      expect(threeWayMergePersonalStates(base, localDelete, remoteDelete).movies["m1"]?.comments).toBeUndefined();

      // Combination 6: Same-ID concurrent additions with different content -> Local wins
      const baseEmptyComments: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, comments: [] } },
      };
      const localAddedNew: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [{ id: "c_new", text: "Local text", createdAt: "2026-01-02T00:00:00.000Z" }],
          },
        },
      };
      const remoteAddedNew: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [{ id: "c_new", text: "Remote text", createdAt: "2026-01-02T00:00:00.000Z" }],
          },
        },
      };
      const sameIdConflict = threeWayMergePersonalStates(baseEmptyComments, localAddedNew, remoteAddedNew).movies["m1"]?.comments;
      expect(sameIdConflict).toHaveLength(1);
      expect(sameIdConflict?.[0]?.text).toBe("Local text");

      // Combination 7: Deterministic comment ordering with identical timestamps
      const localCommA: PersonalComment = { id: "c_b", text: "B", createdAt: "2026-01-03T00:00:00.000Z" };
      const remoteCommB: PersonalComment = { id: "c_a", text: "A", createdAt: "2026-01-03T00:00:00.000Z" };
      const localAdd: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, comments: [localCommA] } },
      };
      const remoteAdd: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: { m1: { ...base.movies["m1"]!, comments: [remoteCommB] } },
      };
      const sortedResult = threeWayMergePersonalStates(baseEmptyComments, localAdd, remoteAdd).movies["m1"]?.comments;
      expect(sortedResult).toHaveLength(2);
      expect(sortedResult?.[0]?.id).toBe("c_a");
      expect(sortedResult?.[1]?.id).toBe("c_b");
    });

    it("Section 4: Genuine three-way movie snapshot metadata merging", () => {
      const baseSnap: MovieSnapshot = {
        id: "m1",
        title: "Base Title",
        year: 2010,
        rating: 6.5,
        posterUrl: "/base-poster.jpg",
        art: ["/base-1.jpg", "/base-2.jpg"],
        genres: ["Action", "Drama"],
      };

      // Case 1: Local only changed rating to 8.0, Remote changed title to "Remote Title" and added "Sci-Fi" to genres
      const localSnap1: MovieSnapshot = {
        ...baseSnap,
        rating: 8.0,
      };
      const remoteSnap1: MovieSnapshot = {
        ...baseSnap,
        title: "Remote Title",
        genres: ["Action", "Drama", "Sci-Fi"],
      };

      const mergedSnap1 = threeWayMergeMovieSnapshot(baseSnap, localSnap1, remoteSnap1, "m1");
      expect(mergedSnap1.title).toBe("Remote Title"); // Remote accepted
      expect(mergedSnap1.rating).toBe(8.0); // Local retained
      expect(mergedSnap1.year).toBe(2010); // Base unchanged
      expect(mergedSnap1.posterUrl).toBe("/base-poster.jpg");
      expect(mergedSnap1.art).toEqual(["/base-1.jpg", "/base-2.jpg"]);
      expect(mergedSnap1.genres).toEqual(["Action", "Drama", "Sci-Fi"]); // Remote accepted

      // Case 2: Conflicting field changes -> Local preferred
      const localSnap2: MovieSnapshot = {
        ...baseSnap,
        title: "Local Title",
        posterUrl: "/local-poster.jpg",
      };
      const remoteSnap2: MovieSnapshot = {
        ...baseSnap,
        title: "Remote Title",
        posterUrl: "/remote-poster.jpg",
      };
      const mergedSnap2 = threeWayMergeMovieSnapshot(baseSnap, localSnap2, remoteSnap2, "m1");
      expect(mergedSnap2.title).toBe("Local Title");
      expect(mergedSnap2.posterUrl).toBe("/local-poster.jpg");

      // Case 3: Remote changed art, Local unchanged from Base -> Remote art accepted
      const remoteSnap3: MovieSnapshot = {
        ...baseSnap,
        art: ["/new-1.jpg", "/new-2.jpg"],
      };
      const mergedSnap3 = threeWayMergeMovieSnapshot(baseSnap, baseSnap, remoteSnap3, "m1");
      expect(mergedSnap3.art).toEqual(["/new-1.jpg", "/new-2.jpg"]);
    });

    it("Section 5: Merge results are purely deterministic with no wall-clock generation", () => {
      const base: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            id: "m1",
            snapshot: mockSnapshot,
            isFavorite: true,
            listStatus: "watchlist",
            personalRating: null,
            comments: [],
            updatedAt: "invalid-timestamp",
          },
        },
      };
      const local: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            personalRating: 8,
            updatedAt: "another-invalid-timestamp",
          },
        },
      };
      const remote: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m1: {
            ...base.movies["m1"]!,
            comments: [{ id: "c1", text: "Note", createdAt: "invalid-time" }],
            updatedAt: "corrupt",
          },
        },
      };

      const run1 = threeWayMergePersonalStates(base, local, remote);
      const run2 = threeWayMergePersonalStates(base, local, remote);

      expect(run1).toEqual(run2);
      expect(run1.movies["m1"]?.updatedAt).toBe("1970-01-01T00:00:00.000Z");
    });

    it("Section 6: Remote clear and repeated-event sequence test", () => {
      resetPersonalStorageCache();
      localStorage.clear();

      const unsubscribe = subscribePersonalStorage(() => {});

      // 1. Storage becomes unavailable, Local pending favorite on m_local
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      let localState = getPersonalStorageSnapshot();
      localState = toggleFavoriteInStore(localState, "m_local", { ...mockSnapshot, id: "m_local", title: "Local Fav" });
      writePersonalStorage(localState);

      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);

      setItemSpy.mockRestore();

      // 2. Remote event 1 adds a different favorite (m_rem1)
      const remoteState1: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m_rem1: {
            id: "m_rem1",
            snapshot: { ...mockSnapshot, id: "m_rem1", title: "Remote 1" },
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState1));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState1),
          storageArea: localStorage,
        })
      );
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_rem1"]?.isFavorite).toBe(true);

      // 3. Remote event 2 removes remote favorite m_rem1
      const remoteState2: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState2));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState2),
          storageArea: localStorage,
        })
      );
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_rem1"]).toBeUndefined();

      // 4. Remote clear event (localStorage.clear())
      localStorage.clear();
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
          newValue: null,
          oldValue: null,
          storageArea: localStorage,
        })
      );
      // Local pending favorite still survives
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(true);

      // 5. Remote event 3 adds a new record (m_rem3)
      const remoteState3: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m_rem3: {
            id: "m_rem3",
            snapshot: { ...mockSnapshot, id: "m_rem3", title: "Remote 3" },
            isFavorite: false,
            listStatus: "watched",
            personalRating: 9,
            comments: [],
            updatedAt: "2026-01-04T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(remoteState3));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(remoteState3),
          storageArea: localStorage,
        })
      );

      // 6 & 7. Local pending favorite survives throughout; only m_local and m_rem3 exist
      const snapshotAfterSeq = getPersonalStorageSnapshot();
      expect(snapshotAfterSeq.movies["m_local"]?.isFavorite).toBe(true);
      expect(snapshotAfterSeq.movies["m_rem3"]?.listStatus).toBe("watched");
      expect(Object.keys(snapshotAfterSeq.movies).sort()).toEqual(["m_local", "m_rem3"]);

      // 8. hasPersonalSessionMutations() remains true
      expect(hasPersonalSessionMutations()).toBe(true);

      // 9. Successful persistence writes full merged state and clears baseline state
      const success = writePersonalStorage(getPersonalStorageSnapshot());
      expect(success).toBe(true);
      expect(hasPersonalSessionMutations()).toBe(false);
      expect(getSessionBaseSnapshot()).toBeNull();
      expect(getLatestRemoteSnapshot()).toBeNull();

      const diskData = JSON.parse(localStorage.getItem(PERSONAL_STORAGE_KEY)!);
      expect(Object.keys(diskData.movies).sort()).toEqual(["m_local", "m_rem3"]);

      // 10. Normal cross-tab synchronization when no session mutations are pending
      const normalRemoteUpdate: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {
          m_normal: {
            id: "m_normal",
            snapshot: { ...mockSnapshot, id: "m_normal" },
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-05T00:00:00.000Z",
          },
        },
      };
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(normalRemoteUpdate));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(normalRemoteUpdate),
          storageArea: localStorage,
        })
      );
      expect(Object.keys(getPersonalStorageSnapshot().movies)).toEqual(["m_normal"]);
      expect(hasPersonalSessionMutations()).toBe(false);

      unsubscribe();
    });
  });

  describe("Phase 6.11.6 — Storage Recovery During Pending Mutations & Equality Stabilization", () => {
    describe("areRecordsEqual comment order insensitivity & invariants", () => {
      const commentA: PersonalComment = { id: "c1", text: "Alpha", createdAt: "2026-01-01T00:00:00.000Z" };
      const commentB: PersonalComment = { id: "c2", text: "Beta", createdAt: "2026-01-02T00:00:00.000Z" };

      const baseRecord: PersonalRecord = {
        id: "m1",
        snapshot: mockSnapshot,
        isFavorite: true,
        listStatus: "watchlist",
        personalRating: 8.5,
        comments: [commentA, commentB],
        updatedAt: "2026-01-02T00:00:00.000Z",
      };

      it("1. Same comments in different array orders produce true", () => {
        const reorderedRecord: PersonalRecord = {
          ...baseRecord,
          comments: [commentB, commentA],
        };
        expect(areRecordsEqual(baseRecord, reorderedRecord)).toBe(true);
      });

      it("2. A changed comment text produces false", () => {
        const changedTextRecord: PersonalRecord = {
          ...baseRecord,
          comments: [commentA, { ...commentB, text: "Beta modified" }],
        };
        expect(areRecordsEqual(baseRecord, changedTextRecord)).toBe(false);
      });

      it("3. A changed createdAt produces false", () => {
        const changedDateRecord: PersonalRecord = {
          ...baseRecord,
          comments: [commentA, { ...commentB, createdAt: "2026-01-05T00:00:00.000Z" }],
        };
        expect(areRecordsEqual(baseRecord, changedDateRecord)).toBe(false);
      });

      it("4. A missing comment produces false", () => {
        const missingCommentRecord: PersonalRecord = {
          ...baseRecord,
          comments: [commentA],
        };
        expect(areRecordsEqual(baseRecord, missingCommentRecord)).toBe(false);
      });

      it("5. Duplicate comment IDs with different counts produce false without silent discarding", () => {
        const duplicateA: PersonalRecord = {
          ...baseRecord,
          comments: [commentA, commentA],
        };
        const duplicateB: PersonalRecord = {
          ...baseRecord,
          comments: [commentA, commentB],
        };
        expect(areRecordsEqual(duplicateA, duplicateB)).toBe(false);
      });

      it("6. areStatesEqual correctly compares schemas across movies and profiles", () => {
        const schemaA: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: { m1: baseRecord },
          profile: { displayName: "User", bio: "Bio" },
        };
        const schemaB: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: { m1: { ...baseRecord, comments: [commentB, commentA] } },
          profile: { displayName: "User", bio: "Bio" },
        };
        expect(areStatesEqual(schemaA, schemaB)).toBe(true);

        const schemaC: PersonalStorageSchema = {
          ...schemaA,
          profile: { displayName: "Other", bio: "Bio" },
        };
        expect(areStatesEqual(schemaA, schemaC)).toBe(false);
      });
    });

    describe("Storage recovery during pending session mutations", () => {
      it("merges remote changes received during storage inaccessibility upon recovery with exactly 1 notification", () => {
        resetPersonalStorageCache();
        const realStorage = window.localStorage;
        realStorage.clear();

        // 1 & 2. Seed Base personal data
        const baseState: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_base: {
              id: "m_base",
              snapshot: mockSnapshot,
              isFavorite: true,
              listStatus: null,
              personalRating: 5,
              comments: [],
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        };
        realStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(baseState));

        const listener = vi.fn();
        const unsub = subscribePersonalStorage(listener);
        listener.mockClear();

        // 3. Create local session mutation by forcing local write to fail
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("QuotaExceededError");
        });

        let localState = getPersonalStorageSnapshot();
        localState = setPersonalRatingInStore(localState, "m_base", mockSnapshot, 9);
        localState = toggleFavoriteInStore(localState, "m_local", { ...mockSnapshot, id: "m_local" });
        writePersonalStorage(localState);

        expect(hasPersonalSessionMutations()).toBe(true);
        expect(getSessionBaseSnapshot()?.movies["m_base"]?.personalRating).toBe(5);
        const originalBase = getSessionBaseSnapshot();

        setItemSpy.mockRestore();

        // 4. Make window.localStorage getter throw SecurityError (inaccessible)
        const getterSpy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
          throw new DOMException("The operation is insecure.", "SecurityError");
        });

        // 5. Simulate remote write using the retained Storage reference (representing another tab)
        const remoteState: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_base: {
              ...baseState.movies["m_base"]!,
              comments: [{ id: "c_rem", text: "Remote comment", createdAt: "2026-01-02T00:00:00.000Z" }],
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
            m_remote: {
              id: "m_remote",
              snapshot: { ...mockSnapshot, id: "m_remote" },
              isFavorite: true,
              listStatus: "watched",
              personalRating: null,
              comments: [],
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          },
        };
        Storage.prototype.setItem.call(realStorage, PERSONAL_STORAGE_KEY, JSON.stringify(remoteState));

        // 6. Dispatch storage event while local getter is inaccessible
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: PERSONAL_STORAGE_KEY,
            newValue: JSON.stringify(remoteState),
            storageArea: realStorage,
          })
        );

        // 7. Verify local session state survives and storage is marked unavailable
        expect(isPersonalStorageAvailable()).toBe(false);
        expect(getPersonalStorageSnapshot().movies["m_base"]?.personalRating).toBe(9);
        expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
        expect(hasPersonalSessionMutations()).toBe(true);

        // 8. Restore the real getter
        getterSpy.mockRestore();
        listener.mockClear();

        // 9. Call checkPersonalStorageAvailability() to recover
        const available = checkPersonalStorageAvailability();
        expect(available).toBe(true);
        expect(isPersonalStorageAvailable()).toBe(true);

        // 10. Verify recovery outcome:
        // Remote changes are merged into the local snapshot
        const recoveredSnapshot = getPersonalStorageSnapshot();
        expect(recoveredSnapshot.movies["m_remote"]?.listStatus).toBe("watched");
        expect(recoveredSnapshot.movies["m_base"]?.comments).toHaveLength(1);
        expect(recoveredSnapshot.movies["m_base"]?.comments?.[0]?.id).toBe("c_rem");

        // Local session mutations remain intact
        expect(recoveredSnapshot.movies["m_base"]?.personalRating).toBe(9);
        expect(recoveredSnapshot.movies["m_local"]?.isFavorite).toBe(true);

        // The latest remote baseline is updated to the remote state
        expect(getLatestRemoteSnapshot()?.movies["m_remote"]?.isFavorite).toBe(true);

        // The original session base remains unchanged
        expect(getSessionBaseSnapshot()).toBe(originalBase);

        // hasPersonalSessionMutations() remains true
        expect(hasPersonalSessionMutations()).toBe(true);

        // Subscribers receive exactly one notification for recovery
        expect(listener).toHaveBeenCalledTimes(1);

        // 11. Persist the merged local state successfully
        const persistSuccess = writePersonalStorage(getPersonalStorageSnapshot());
        expect(persistSuccess).toBe(true);

        // 12. Verify full merged data is written and all pending merge state is cleared
        expect(hasPersonalSessionMutations()).toBe(false);
        expect(getSessionBaseSnapshot()).toBeNull();
        expect(getLatestRemoteSnapshot()).toBeNull();

        const diskData = JSON.parse(realStorage.getItem(PERSONAL_STORAGE_KEY)!);
        expect(diskData.movies["m_base"]?.personalRating).toBe(9);
        expect(diskData.movies["m_base"]?.comments?.[0]?.id).toBe("c_rem");
        expect(diskData.movies["m_local"]?.isFavorite).toBe(true);
        expect(diskData.movies["m_remote"]?.isFavorite).toBe(true);

        unsub();
      });

      it("does not mark storage available when probe succeeds but reading personal data throws", () => {
        resetPersonalStorageCache();
        const unsub = subscribePersonalStorage(() => {});

        // Probe succeeds (setItem and removeItem work)
        // But getItem on PERSONAL_STORAGE_KEY throws
        const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
          if (key === PERSONAL_STORAGE_KEY) {
            throw new DOMException("The operation is insecure.", "SecurityError");
          }
          return null;
        });

        const available = checkPersonalStorageAvailability();
        expect(available).toBe(false);
        expect(isPersonalStorageAvailable()).toBe(false);

        getItemSpy.mockRestore();
        unsub();
      });
    });
  });

  describe("Phase 6.11.7 — Complete Snapshot Equality & Recovery Regression", () => {
    const baseSnapshot: MovieSnapshot = {
      id: "m_test",
      title: "Snapshot Alpha",
      year: 2021,
      rating: 8.4,
      posterUrl: "/posters/alpha.jpg",
      art: ["/art/alpha-1.jpg", "/art/alpha-2.jpg"],
      genres: ["Action", "Sci-Fi"],
    };

    describe("areSnapshotsEqual structural and field-by-field verification", () => {
      it("returns true for identical reference and structurally identical distinct objects", () => {
        expect(areSnapshotsEqual(baseSnapshot, baseSnapshot)).toBe(true);

        const clone: MovieSnapshot = {
          id: "m_test",
          title: "Snapshot Alpha",
          year: 2021,
          rating: 8.4,
          posterUrl: "/posters/alpha.jpg",
          art: ["/art/alpha-1.jpg", "/art/alpha-2.jpg"],
          genres: ["Action", "Sci-Fi"],
        };
        expect(areSnapshotsEqual(baseSnapshot, clone)).toBe(true);
      });

      it("returns false when id differs", () => {
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, id: "m_diff" })).toBe(false);
      });

      it("returns false when title differs", () => {
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, title: "Modified Title" })).toBe(false);
      });

      it("handles year changes and null transitions", () => {
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, year: 2022 })).toBe(false);
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, year: null })).toBe(false);

        const nullYearA: MovieSnapshot = { ...baseSnapshot, year: null };
        const nullYearB: MovieSnapshot = { ...baseSnapshot, year: null };
        expect(areSnapshotsEqual(nullYearA, nullYearB)).toBe(true);
      });

      it("handles rating changes and null transitions", () => {
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, rating: 9.1 })).toBe(false);
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, rating: null })).toBe(false);

        const nullRatingA: MovieSnapshot = { ...baseSnapshot, rating: null };
        const nullRatingB: MovieSnapshot = { ...baseSnapshot, rating: null };
        expect(areSnapshotsEqual(nullRatingA, nullRatingB)).toBe(true);
      });

      it("handles posterUrl changes and null transitions", () => {
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, posterUrl: "/other.jpg" })).toBe(false);
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, posterUrl: null })).toBe(false);

        const nullPosterA: MovieSnapshot = { ...baseSnapshot, posterUrl: null };
        const nullPosterB: MovieSnapshot = { ...baseSnapshot, posterUrl: null };
        expect(areSnapshotsEqual(nullPosterA, nullPosterB)).toBe(true);

        // Empty string normalizes to null and matches null or undefined
        const emptyPoster: MovieSnapshot = { ...baseSnapshot, posterUrl: "" };
        expect(areSnapshotsEqual(emptyPoster, nullPosterA)).toBe(true);
        expect(areSnapshotsEqual(nullPosterA, emptyPoster)).toBe(true);

        const undefinedPoster: MovieSnapshot = {
          ...baseSnapshot,
          posterUrl: undefined as unknown as string | null,
        };
        expect(areSnapshotsEqual(emptyPoster, undefinedPoster)).toBe(true);
        expect(areSnapshotsEqual(undefinedPoster, emptyPoster)).toBe(true);

        // Two different non-empty URLs remain unequal
        const posterOne: MovieSnapshot = { ...baseSnapshot, posterUrl: "/poster-one.jpg" };
        const posterTwo: MovieSnapshot = { ...baseSnapshot, posterUrl: "/poster-two.jpg" };
        expect(areSnapshotsEqual(posterOne, posterTwo)).toBe(false);
      });

      it("handles art changes and null transitions", () => {
        expect(
          areSnapshotsEqual(baseSnapshot, {
            ...baseSnapshot,
            art: ["/art/alpha-1.jpg", "/art/different.jpg"],
          })
        ).toBe(false);
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, art: null })).toBe(false);

        const nullArtA: MovieSnapshot = { ...baseSnapshot, art: null };
        const nullArtB: MovieSnapshot = { ...baseSnapshot, art: null };
        expect(areSnapshotsEqual(nullArtA, nullArtB)).toBe(true);
      });

      it("handles genre changes and order/count differences", () => {
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, genres: ["Action", "Drama"] })).toBe(false);
        expect(areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, genres: ["Action"] })).toBe(false);
        expect(
          areSnapshotsEqual(baseSnapshot, { ...baseSnapshot, genres: ["Action", "Sci-Fi", "Adventure"] })
        ).toBe(false);

        const distinctGenreArray: MovieSnapshot = {
          ...baseSnapshot,
          genres: ["Action", "Sci-Fi"],
        };
        expect(areSnapshotsEqual(baseSnapshot, distinctGenreArray)).toBe(true);
      });

      it("tests areArtEqual and areGenresEqual helper functions directly", () => {
        expect(areArtEqual(["/a.jpg", "/b.jpg"], ["/a.jpg", "/b.jpg"])).toBe(true);
        expect(areArtEqual(["/a.jpg", "/b.jpg"], ["/a.jpg", "/diff.jpg"])).toBe(false);
        expect(areArtEqual(null, null)).toBe(true);
        expect(areArtEqual(null, ["/a.jpg", "/b.jpg"])).toBe(false);

        expect(areGenresEqual(["Action", "Sci-Fi"], ["Action", "Sci-Fi"])).toBe(true);
        expect(areGenresEqual(["Action"], ["Action", "Sci-Fi"])).toBe(false);
        expect(areGenresEqual(undefined, [])).toBe(true);
      });
    });

    describe("areRecordsEqual integration with movie snapshot equality", () => {
      const baseRecord: PersonalRecord = {
        id: "m_test",
        snapshot: baseSnapshot,
        isFavorite: true,
        listStatus: "watchlist",
        personalRating: 8.5,
        comments: [{ id: "c1", text: "Note", createdAt: "2026-01-01T00:00:00.000Z" }],
        updatedAt: "2026-01-01T00:00:00.000Z",
      };

      it("detects snapshot changes within areRecordsEqual", () => {
        const changedSnapshotRecord: PersonalRecord = {
          ...baseRecord,
          snapshot: { ...baseSnapshot, title: "Changed Snapshot Title" },
        };
        expect(areRecordsEqual(baseRecord, changedSnapshotRecord)).toBe(false);

        const changedGenreRecord: PersonalRecord = {
          ...baseRecord,
          snapshot: { ...baseSnapshot, genres: ["Action", "Comedy"] },
        };
        expect(areRecordsEqual(baseRecord, changedGenreRecord)).toBe(false);
      });

      it("returns true when snapshot has identical values across different object references", () => {
        const clonedRecord: PersonalRecord = {
          ...baseRecord,
          snapshot: {
            ...baseSnapshot,
            art: ["/art/alpha-1.jpg", "/art/alpha-2.jpg"],
            genres: ["Action", "Sci-Fi"],
          },
        };
        expect(areRecordsEqual(baseRecord, clonedRecord)).toBe(true);
      });

      it("does not consider updatedAt difference as a record inequality", () => {
        const differentUpdatedAtRecord: PersonalRecord = {
          ...baseRecord,
          updatedAt: "2026-12-31T23:59:59.999Z",
        };
        expect(areRecordsEqual(baseRecord, differentUpdatedAtRecord)).toBe(true);
      });
    });

    describe("areStatesEqual integration with snapshot changes", () => {
      it("detects snapshot changes across schemas", () => {
        const schemaA: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_test: {
              id: "m_test",
              snapshot: baseSnapshot,
              isFavorite: false,
              listStatus: "watched",
              personalRating: null,
              comments: [],
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        };

        const schemaB: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_test: {
              ...schemaA.movies["m_test"]!,
              snapshot: { ...baseSnapshot, rating: 9.9 },
            },
          },
        };

        expect(areStatesEqual(schemaA, schemaB)).toBe(false);

        const schemaC: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_test: {
              ...schemaA.movies["m_test"]!,
              snapshot: {
                ...baseSnapshot,
                art: ["/art/alpha-1.jpg", "/art/alpha-2.jpg"],
                genres: ["Action", "Sci-Fi"],
              },
            },
          },
        };
        expect(areStatesEqual(schemaA, schemaC)).toBe(true);
      });
    });

    describe("Section 3: Recovery regression with remote snapshot metadata updates", () => {
      it("recovers and merges remote snapshot metadata changes while preserving pending session mutations", () => {
        resetPersonalStorageCache();
        const realStorage = window.localStorage;
        realStorage.clear();

        // 1. Seed localStorage with Base state containing an existing movie and original snapshot
        const originalSnapshot: MovieSnapshot = {
          id: "m_snap",
          title: "Original Snapshot Title",
          year: 2018,
          rating: 7.2,
          posterUrl: "/original-poster.jpg",
          art: ["/orig-1.jpg", "/orig-2.jpg"],
          genres: ["Sci-Fi", "Drama"],
        };

        const baseState: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_snap: {
              id: "m_snap",
              snapshot: originalSnapshot,
              isFavorite: false,
              listStatus: "watchlist",
              personalRating: null,
              comments: [],
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        };
        realStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(baseState));

        // 2. Initialize the cached snapshot
        const listener = vi.fn();
        const unsub = subscribePersonalStorage(listener);
        listener.mockClear();

        // 3. Create a local session-only personal mutation by forcing persistence to fail
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("Disk full (QuotaExceededError)");
        });

        let localState = getPersonalStorageSnapshot();
        localState = setPersonalRatingInStore(localState, "m_snap", originalSnapshot, 9.0);
        writePersonalStorage(localState);

        expect(hasPersonalSessionMutations()).toBe(true);
        const originalBase = getSessionBaseSnapshot();
        expect(originalBase?.movies["m_snap"]?.personalRating).toBeNull();
        expect(getPersonalStorageSnapshot().movies["m_snap"]?.personalRating).toBe(9.0);

        setItemSpy.mockRestore();

        // 4. Make window.localStorage inaccessible while retaining a valid Storage reference
        const getterSpy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
          throw new DOMException("The operation is insecure.", "SecurityError");
        });

        // 5. Simulate another tab updating snapshot metadata and persisting through the retained Storage reference
        const updatedRemoteSnapshot: MovieSnapshot = {
          ...originalSnapshot,
          title: "Remotely Updated Title",
          rating: 8.9,
          genres: ["Sci-Fi", "Drama", "Mystery"],
        };

        const remoteState: PersonalStorageSchema = {
          version: CURRENT_STORAGE_VERSION,
          movies: {
            m_snap: {
              ...baseState.movies["m_snap"]!,
              snapshot: updatedRemoteSnapshot,
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          },
        };
        Storage.prototype.setItem.call(realStorage, PERSONAL_STORAGE_KEY, JSON.stringify(remoteState));

        window.dispatchEvent(
          new StorageEvent("storage", {
            key: PERSONAL_STORAGE_KEY,
            newValue: JSON.stringify(remoteState),
            storageArea: realStorage,
          })
        );

        expect(isPersonalStorageAvailable()).toBe(false);

        // 6. Restore localStorage access
        getterSpy.mockRestore();
        listener.mockClear();

        // 7. Call checkPersonalStorageAvailability()
        const available = checkPersonalStorageAvailability();
        expect(available).toBe(true);
        expect(isPersonalStorageAvailable()).toBe(true);

        // 8. Verify recovery assertions:
        // - The remote snapshot metadata change is accepted
        const recoveredSnapshot = getPersonalStorageSnapshot();
        expect(recoveredSnapshot.movies["m_snap"]?.snapshot.title).toBe("Remotely Updated Title");
        expect(recoveredSnapshot.movies["m_snap"]?.snapshot.rating).toBe(8.9);
        expect(recoveredSnapshot.movies["m_snap"]?.snapshot.genres).toEqual(["Sci-Fi", "Drama", "Mystery"]);

        // - The local session-only personal mutation is preserved
        expect(recoveredSnapshot.movies["m_snap"]?.personalRating).toBe(9.0);
        expect(recoveredSnapshot.movies["m_snap"]?.listStatus).toBe("watchlist");

        // - The original session Base remains unchanged
        expect(getSessionBaseSnapshot()).toBe(originalBase);
        expect(getSessionBaseSnapshot()?.movies["m_snap"]?.snapshot.title).toBe("Original Snapshot Title");

        // - latestRemoteSnapshot reflects the latest remote data
        expect(getLatestRemoteSnapshot()?.movies["m_snap"]?.snapshot.title).toBe("Remotely Updated Title");
        expect(getLatestRemoteSnapshot()?.movies["m_snap"]?.snapshot.rating).toBe(8.9);

        // - Exactly one subscriber notification occurs during recovery
        expect(listener).toHaveBeenCalledTimes(1);

        // - The pending session mutation flag remains true until successful persistence
        expect(hasPersonalSessionMutations()).toBe(true);

        // 9. Persist the merged state and verify that both the local personal mutation and remote snapshot change are present on disk
        const persistSuccess = writePersonalStorage(getPersonalStorageSnapshot());
        expect(persistSuccess).toBe(true);
        expect(hasPersonalSessionMutations()).toBe(false);
        expect(getSessionBaseSnapshot()).toBeNull();
        expect(getLatestRemoteSnapshot()).toBeNull();

        const diskData = JSON.parse(realStorage.getItem(PERSONAL_STORAGE_KEY)!);
        expect(diskData.movies["m_snap"]?.snapshot.title).toBe("Remotely Updated Title");
        expect(diskData.movies["m_snap"]?.snapshot.genres).toEqual(["Sci-Fi", "Drama", "Mystery"]);
        expect(diskData.movies["m_snap"]?.personalRating).toBe(9.0);

        unsub();
      });
    });
  });

  describe("Phase 6.11.8 — Safe Handling of Corrupted and Unsupported Storage Payloads", () => {
    const validMovieRecord: PersonalRecord = {
      id: "m_seed",
      snapshot: {
        id: "m_seed",
        title: "Seed Title",
        year: 2020,
        rating: 8.0,
        posterUrl: "/seed.jpg",
        art: null,
        genres: ["Drama"],
      },
      isFavorite: true,
      listStatus: "watchlist",
      personalRating: 8.5,
      comments: [{ id: "c1", text: "Original", createdAt: "2026-01-01T00:00:00.000Z" }],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const validState: PersonalStorageSchema = {
      version: CURRENT_STORAGE_VERSION,
      movies: { m_seed: validMovieRecord },
      profile: { displayName: "Alice", bio: "Movie lover" },
    };

    beforeEach(() => {
      resetPersonalStorageCache();
      window.localStorage.clear();
    });

    it("Scenario A: Existing valid cached data is preserved across malformed JSON storage events", () => {
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(validState));
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);

      // Verify initial snapshot loaded
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);
      listener.mockClear();

      // Another tab writes corrupted JSON string
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, "{ broken json syntax !!!");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: "{ broken json syntax !!!",
          storageArea: window.localStorage,
        })
      );

      // In-memory data must be completely preserved
      const snapAfterCorrupt = getPersonalStorageSnapshot();
      expect(snapAfterCorrupt.movies["m_seed"]?.isFavorite).toBe(true);
      expect(snapAfterCorrupt.movies["m_seed"]?.personalRating).toBe(8.5);
      expect(snapAfterCorrupt.profile?.displayName).toBe("Alice");
      expect(listener).not.toHaveBeenCalled();

      // Test with pending session mutations
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      let mutated = getPersonalStorageSnapshot();
      mutated = toggleFavoriteInStore(mutated, "m_local", {
        id: "m_local",
        title: "Local Only",
        year: null,
        rating: null,
        posterUrl: null,
        art: null,
        genres: [],
      });
      writePersonalStorage(mutated);
      setItemSpy.mockRestore();

      expect(hasPersonalSessionMutations()).toBe(true);

      // Another corrupted storage event
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: "not valid json",
          storageArea: window.localStorage,
        })
      );

      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_local"]?.isFavorite).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);

      unsub();
    });

    it("Scenario B: Unsupported storage version is not interpreted as valid empty state", () => {
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(validState));
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);

      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);
      listener.mockClear();

      const futureVersionPayload = {
        version: 2,
        movies: {
          m_future: {
            id: "m_future",
            snapshot: {
              id: "m_future",
              title: "Future Movie",
              year: 2030,
              rating: 9,
              posterUrl: null,
              art: null,
              genres: [],
            },
            isFavorite: true,
            listStatus: null,
            updatedAt: "2030-01-01T00:00:00.000Z",
          },
        },
      };

      const result = safeReadPersonalStorage({
        getItem: () => JSON.stringify(futureVersionPayload),
      } as unknown as Storage);
      expect(result).toEqual({ success: false, reason: "unsupported_version" });

      // Dispatch storage event with unsupported version
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(futureVersionPayload));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify(futureVersionPayload),
          storageArea: window.localStorage,
        })
      );

      // Existing cached data must remain protected
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_future"]).toBeUndefined();
      expect(listener).not.toHaveBeenCalled();

      unsub();
    });

    it("Scenario C: Invalid root structure or invalid movies container does not cause accidental snapshot replacement", () => {
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(validState));
      const unsub = subscribePersonalStorage(() => {});
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);

      // Case 1: Array root
      const arrayResult = safeReadPersonalStorage({
        getItem: () => JSON.stringify([1, 2, 3]),
      } as unknown as Storage);
      expect(arrayResult).toEqual({ success: false, reason: "corrupt" });

      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify([1, 2, 3]));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: JSON.stringify([1, 2, 3]),
          storageArea: window.localStorage,
        })
      );
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);

      // Case 2: Primitive string root
      const primitiveResult = safeReadPersonalStorage({
        getItem: () => JSON.stringify("plain string"),
      } as unknown as Storage);
      expect(primitiveResult).toEqual({ success: false, reason: "corrupt" });

      // Case 3: Missing movies container
      const missingMoviesResult = safeReadPersonalStorage({
        getItem: () => JSON.stringify({ version: 1 }),
      } as unknown as Storage);
      expect(missingMoviesResult).toEqual({ success: false, reason: "corrupt" });

      // Case 4: movies is an Array instead of Record
      const arrayMoviesResult = safeReadPersonalStorage({
        getItem: () => JSON.stringify({ version: 1, movies: [validMovieRecord] }),
      } as unknown as Storage);
      expect(arrayMoviesResult).toEqual({ success: false, reason: "corrupt" });

      // Case 5: movies is a string
      const stringMoviesResult = safeReadPersonalStorage({
        getItem: () => JSON.stringify({ version: 1, movies: "not-an-object" }),
      } as unknown as Storage);
      expect(stringMoviesResult).toEqual({ success: false, reason: "corrupt" });

      // Snapshot remains intact across all cases
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);
      unsub();
    });

    it("Scenario D: getItem() throwing SyntaxError is classified as inaccessible, not corrupt", () => {
      const syntaxErrorStorage = {
        getItem: () => {
          throw new SyntaxError("Unexpected token in storage driver engine");
        },
      } as unknown as Storage;

      const result = safeReadPersonalStorage(syntaxErrorStorage);
      expect(result).toEqual({
        success: false,
        reason: "inaccessible",
      });
    });

    it("Scenario E: Recovery while session mutations are pending preserves local state when disk is malformed", () => {
      // 1. Seed valid base state
      const realStorage = window.localStorage;
      realStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(validState));
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // 2. Local session mutation fails persistence
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Disk Full");
      });

      let localState = getPersonalStorageSnapshot();
      localState = setPersonalRatingInStore(localState, "m_seed", validMovieRecord.snapshot, 9.5);
      writePersonalStorage(localState);
      expect(hasPersonalSessionMutations()).toBe(true);
      setItemSpy.mockRestore();

      // 3. Make localStorage getter throw SecurityError
      const getterSpy = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new DOMException("Access Denied", "SecurityError");
      });

      // 4. Corrupt disk payload while getter is blocked using retained Storage reference
      Storage.prototype.setItem.call(realStorage, PERSONAL_STORAGE_KEY, "{ damaged json payload");

      // 5. Restore getter
      getterSpy.mockRestore();
      listener.mockClear();

      // 6. Call checkPersonalStorageAvailability()
      const isAvailable = checkPersonalStorageAvailability();
      // Storage probe succeeds, so availability is true
      expect(isAvailable).toBe(true);
      expect(isPersonalStorageAvailable()).toBe(true);

      // 7. Verify local session data survived and was not overwritten or merged with empty state
      const recovered = getPersonalStorageSnapshot();
      expect(recovered.movies["m_seed"]?.personalRating).toBe(9.5);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getSessionBaseSnapshot()?.movies["m_seed"]?.personalRating).toBe(8.5);
      // latestRemoteSnapshot was not updated with empty state
      expect(getLatestRemoteSnapshot()?.movies["m_seed"]?.personalRating).toBe(8.5);

      unsub();
    });

    it("Scenario F: Genuine deletion via missing key and localStorage.clear() retains intended existing behavior", () => {
      // 1. Seed valid data
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(validState));
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);
      listener.mockClear();

      // 2. Missing key / localStorage.clear()
      window.localStorage.clear();
      expect(safeReadPersonalStorage(window.localStorage)).toEqual({
        success: true,
        data: getInitialPersonalState(),
      });

      // 3. Dispatch storage event for clear() (key === null)
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: null,
          newValue: null,
          storageArea: window.localStorage,
        })
      );

      // Legitimate deletion is accepted
      expect(getPersonalStorageSnapshot().movies).toEqual({});
      expect(listener).toHaveBeenCalled();

      // 4. Seed again and test removeItem() (key === PERSONAL_STORAGE_KEY, newValue === null)
      writePersonalStorage(validState);
      expect(getPersonalStorageSnapshot().movies["m_seed"]?.isFavorite).toBe(true);
      listener.mockClear();

      window.localStorage.removeItem(PERSONAL_STORAGE_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: null,
          storageArea: window.localStorage,
        })
      );

      expect(getPersonalStorageSnapshot().movies).toEqual({});
      expect(listener).toHaveBeenCalled();

      unsub();
    });
  });

  describe("Phase 6.11.8.1: Prevent Overwriting Unsupported Future Storage Versions", () => {
    const v2PayloadString = JSON.stringify({
      version: 2,
      schemaVariant: "enterprise",
      movies: {
        m_future: {
          id: "m_future",
          snapshot: {
            id: "m_future",
            title: "Future Film 3000",
            year: 2050,
            rating: 9.9,
            posterUrl: "https://example.com/future.jpg",
            art: ["future_bg", "future_accent"],
            genres: ["Sci-Fi", "Time Travel"],
          },
          isFavorite: true,
          listStatus: "watched",
          personalRating: 10,
          customFutureField: { tier: "gold" },
          updatedAt: "2050-01-01T00:00:00.000Z",
        },
      },
      userCustomPreferences: { theme: "holographic" },
    });

    const v1State: PersonalStorageSchema = {
      version: CURRENT_STORAGE_VERSION,
      movies: {
        m_local: {
          id: "m_local",
          snapshot: {
            id: "m_local",
            title: "Local Movie",
            year: 2024,
            rating: 8.0,
            posterUrl: null,
            art: null,
            genres: ["Drama"],
          },
          isFavorite: true,
          listStatus: "watchlist",
          personalRating: 8.5,
          comments: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    };

    beforeEach(() => {
      resetPersonalStorageCache();
      window.localStorage.clear();
    });

    it("Scenario A: writePersonalStorage() blocks overwriting a v2 payload and keeps disk byte-for-byte identical", () => {
      // 1. Seed storage with raw v2 payload
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);

      // 2. Attempt a v1 mutation write
      const writeResult = writePersonalStorage(v1State);

      // 3. Must return false (session-only memory state, not persisted)
      expect(writeResult).toBe(false);

      // 4. Storage on disk must remain byte-for-byte identical to the original v2 JSON string
      const diskPayload = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
      expect(diskPayload).toBe(v2PayloadString);
    });

    it("Scenario B: Attempted mutation is retained in memory with hasPersonalSessionMutations() and hasUnsupportedStorageVersion() true", () => {
      // 1. Seed storage with raw v2 payload
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // 2. Attempt a mutation
      const writeResult = writePersonalStorage(v1State);
      expect(writeResult).toBe(false);

      // 3. Attempted mutation is present in getPersonalStorageSnapshot()
      const snapshot = getPersonalStorageSnapshot();
      expect(snapshot.movies["m_local"]?.isFavorite).toBe(true);
      expect(snapshot.movies["m_local"]?.personalRating).toBe(8.5);

      // 4. Session mutations flag is true
      expect(hasPersonalSessionMutations()).toBe(true);

      // 5. Schema version compatibility flag reflects unsupported version
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 6. Physical storage availability remains true (engine is functional)
      expect(isPersonalStorageAvailable()).toBe(true);

      // 7. Subscribers are notified of the memory update
      expect(listener).toHaveBeenCalled();

      unsub();
    });

    it("Scenario C: Ordinary v1 write succeeds and clears hasUnsupportedStorageVersion()", () => {
      // 1. Write valid v1 state
      const writeResult = writePersonalStorage(v1State);
      expect(writeResult).toBe(true);

      // 2. Flags are clean
      expect(hasPersonalSessionMutations()).toBe(false);
      expect(hasUnsupportedStorageVersion()).toBe(false);
      expect(isPersonalStorageAvailable()).toBe(true);

      // 3. Disk has the persisted v1 JSON
      const diskPayload = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
      expect(diskPayload).not.toBeNull();
      const parsed = JSON.parse(diskPayload!);
      expect(parsed.version).toBe(1);
      expect(parsed.movies["m_local"]?.id).toBe("m_local");
    });

    it("Scenario D: Write to genuinely empty storage (raw === null) succeeds normally", () => {
      // 1. Storage is empty
      window.localStorage.removeItem(PERSONAL_STORAGE_KEY);
      expect(window.localStorage.getItem(PERSONAL_STORAGE_KEY)).toBeNull();

      // 2. Write succeeds
      const writeResult = writePersonalStorage(v1State);
      expect(writeResult).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(false);

      const diskPayload = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
      expect(diskPayload).not.toBeNull();
      const parsed = JSON.parse(diskPayload!);
      expect(parsed.version).toBe(CURRENT_STORAGE_VERSION);
    });

    it("Scenario E: Cross-tab unsupported-version storage event flags unsupported version and subsequent writes remain blocked", () => {
      // 1. Initial valid state
      writePersonalStorage(v1State);
      expect(hasUnsupportedStorageVersion()).toBe(false);

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // 2. Receive cross-tab storage event containing v2 payload
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PERSONAL_STORAGE_KEY,
          newValue: v2PayloadString,
          storageArea: window.localStorage,
        })
      );

      // In-memory snapshot is NOT overwritten with v2
      expect(getPersonalStorageSnapshot().movies["m_local"]?.id).toBe("m_local");
      // Unsupported version is flagged
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 3. Subsequent user mutation via writePersonalStorage is blocked from overwriting disk
      let nextState = getPersonalStorageSnapshot();
      nextState = {
        ...nextState,
        movies: {
          ...nextState.movies,
          m_local_2: {
            id: "m_local_2",
            snapshot: {
              id: "m_local_2",
              title: "Local Movie 2",
              year: 2025,
              rating: 7.0,
              posterUrl: null,
              art: null,
              genres: [],
            },
            isFavorite: true,
            listStatus: null,
            personalRating: null,
            comments: [],
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      };

      const writeResult2 = writePersonalStorage(nextState);
      expect(writeResult2).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(true);
      expect(isPersonalStorageAvailable()).toBe(true);

      // Disk remains untouched v2
      expect(window.localStorage.getItem(PERSONAL_STORAGE_KEY)).toBe(v2PayloadString);

      // Memory retains both local mutations
      const memoryState = getPersonalStorageSnapshot();
      expect(memoryState.movies["m_local"]).toBeDefined();
      expect(memoryState.movies["m_local_2"]).toBeDefined();

      unsub();
    });

    it("Scenario F: Restoring storage to v1 allows subsequent writes to succeed and clears flags", () => {
      // 1. Seed v2
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      const blockedResult = writePersonalStorage(v1State);
      expect(blockedResult).toBe(false);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Storage is reset / migrated back to v1
      const restoredV1State: PersonalStorageSchema = {
        version: CURRENT_STORAGE_VERSION,
        movies: {},
      };
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(restoredV1State));

      // 3. Next write succeeds
      const successResult = writePersonalStorage(v1State);
      expect(successResult).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(false);
      expect(JSON.parse(window.localStorage.getItem(PERSONAL_STORAGE_KEY)!).version).toBe(CURRENT_STORAGE_VERSION);
    });
  });

  describe("Phase 6.11.8.2: Fail-Closed Write Guard and Compatibility-State Consistency", () => {
    const v1State: PersonalStorageSchema = {
      version: CURRENT_STORAGE_VERSION,
      movies: {
        m_local: {
          id: "m_local",
          snapshot: {
            id: "m_local",
            title: "Local Movie",
            year: 2024,
            rating: 8.0,
            posterUrl: null,
            art: null,
            genres: ["Drama"],
          },
          isFavorite: true,
          listStatus: "watchlist",
          personalRating: 8.5,
          comments: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    };

    beforeEach(() => {
      resetPersonalStorageCache();
      window.localStorage.clear();
    });

    it("Section 1 & 2: failed getItem() blocks writes, setItem() is never called, and mutation is retained in memory", () => {
      const backingStore: Record<string, string> = {
        [PERSONAL_STORAGE_KEY]: JSON.stringify({ version: 2, movies: { m_protected: {} } }),
      };

      const setItemSpy = vi.fn((key: string, value: string) => {
        backingStore[key] = value;
      });

      const partiallyFailingStorage = {
        getItem: vi.fn(() => {
          throw new DOMException("Simulated getItem failure", "SecurityError");
        }),
        setItem: setItemSpy,
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 1,
      } as unknown as Storage;

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // Attempt write
      const writeResult = writePersonalStorage(v1State, partiallyFailingStorage);

      // 1. Must fail closed and return false
      expect(writeResult).toBe(false);

      // 2. setItem must NEVER be called (guard cannot be bypassed)
      expect(setItemSpy).not.toHaveBeenCalled();

      // 3. Existing persisted data remains untouched
      expect(backingStore[PERSONAL_STORAGE_KEY]).toBe(
        JSON.stringify({ version: 2, movies: { m_protected: {} } })
      );

      // 4. Attempted mutation is retained in memory
      expect(getPersonalStorageSnapshot().movies["m_local"]?.id).toBe("m_local");

      // 5. Session mutations flag is true
      expect(hasPersonalSessionMutations()).toBe(true);

      // 6. Physical availability is marked false (inaccessible storage policy)
      expect(isPersonalStorageAvailable()).toBe(false);

      // 7. Inaccessible read is NOT classified as an unsupported schema version
      expect(hasUnsupportedStorageVersion()).toBe(false);

      // 8. Subscriber notification occurred via finally
      expect(listener).toHaveBeenCalled();

      unsub();
    });

    it("Section 3: unsupported-version cache consistency across v2 -> v0 and v2 -> v1 transitions", () => {
      // 1. Confirmed newer version (v2) sets cachedUnsupportedVersion = true
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 2, movies: {} })
      );
      const readV2 = safeReadPersonalStorage(window.localStorage);
      expect(readV2).toEqual({ success: false, reason: "unsupported_version" });
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Transition v2 -> v0 (confirmed older version must not leave stale true)
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 0, movies: {} })
      );
      const readV0 = safeReadPersonalStorage(window.localStorage);
      expect(readV0).toEqual({ success: false, reason: "unsupported_version" });
      expect(hasUnsupportedStorageVersion()).toBe(false);

      // 3. Transition v0 -> v2
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 2, movies: {} })
      );
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 4. Transition v2 -> v1 (current version resets flag to false)
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 1, movies: {} })
      );
      const readV1 = safeReadPersonalStorage(window.localStorage);
      expect(readV1.success).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);

      // 5. Valid missing key resets flag to false
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 2, movies: {} })
      );
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      window.localStorage.removeItem(PERSONAL_STORAGE_KEY);
      const readMissing = safeReadPersonalStorage(window.localStorage);
      expect(readMissing.success).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);

      // 6. Unreadable or malformed content does not claim a newer version was confirmed
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, "{ broken malformed JSON !!!");
      const readCorrupt = safeReadPersonalStorage(window.localStorage);
      expect(readCorrupt).toEqual({ success: false, reason: "corrupt" });
      expect(hasUnsupportedStorageVersion()).toBe(false);
    });

    it("Section 4: Malformed payload healing allows valid mutation to overwrite corrupt disk data without discarding state", () => {
      // 1. Seed malformed payload
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, "{ corrupt unparsable json syntax");
      const corruptRead = safeReadPersonalStorage(window.localStorage);
      expect(corruptRead).toEqual({ success: false, reason: "corrupt" });

      const listener = vi.fn();
      const unsub = subscribePersonalStorage(listener);
      listener.mockClear();

      // 2. User mutation occurs
      const writeResult = writePersonalStorage(v1State);

      // 3. Write succeeds as an intentional recovery/heal of the malformed record
      expect(writeResult).toBe(true);

      // 4. Disk now contains valid, parsable v1 schema with user data
      const diskRaw = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
      expect(diskRaw).not.toBeNull();
      const parsed = JSON.parse(diskRaw!);
      expect(parsed.version).toBe(CURRENT_STORAGE_VERSION);
      expect(parsed.movies["m_local"]?.id).toBe("m_local");

      // 5. In-memory user data is fully intact and was not discarded
      const currentSnapshot = getPersonalStorageSnapshot();
      expect(currentSnapshot.movies["m_local"]?.id).toBe("m_local");
      expect(currentSnapshot.movies["m_local"]?.isFavorite).toBe(true);

      // 6. Flags reflect successful persistence
      expect(hasPersonalSessionMutations()).toBe(false);
      expect(hasUnsupportedStorageVersion()).toBe(false);
      expect(isPersonalStorageAvailable()).toBe(true);
      expect(listener).toHaveBeenCalled();

      unsub();
    });
  });

  describe("Phase 6.11.8.3: Clarify Unsupported-Version Cache Semantics", () => {
    const v2PayloadString = JSON.stringify({
      version: 2,
      schemaVariant: "enterprise",
      movies: {
        m_future: {
          id: "m_future",
          snapshot: {
            id: "m_future",
            title: "Future Film 3000",
            year: 2050,
            rating: 9.9,
            posterUrl: "https://example.com/future.jpg",
            art: ["future_bg", "future_accent"],
            genres: ["Sci-Fi", "Time Travel"],
          },
          isFavorite: true,
          listStatus: "watched",
          personalRating: 10,
          customFutureField: { tier: "gold" },
          updatedAt: "2050-01-01T00:00:00.000Z",
        },
      },
      userCustomPreferences: { theme: "holographic" },
    });

    const v1State: PersonalStorageSchema = {
      version: CURRENT_STORAGE_VERSION,
      movies: {
        m_local: {
          id: "m_local",
          snapshot: {
            id: "m_local",
            title: "Local Movie",
            year: 2024,
            rating: 8.0,
            posterUrl: null,
            art: null,
            genres: ["Drama"],
          },
          isFavorite: true,
          listStatus: "watchlist",
          personalRating: 8.5,
          comments: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    };

    beforeEach(() => {
      resetPersonalStorageCache();
      window.localStorage.clear();
    });

    it("Check A: v2 -> corrupt retains the last-known confirmed compatibility flag", () => {
      // 1. Read a valid v2 payload
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      const initialRead = safeReadPersonalStorage(window.localStorage);
      expect(initialRead).toEqual({ success: false, reason: "unsupported_version" });

      // 2. Confirm helper returns true
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 3. Replace disk contents with malformed JSON
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, "{ damaged json payload syntax error");

      // 4. Read again and expect reason: corrupt
      const corruptRead = safeReadPersonalStorage(window.localStorage);
      expect(corruptRead).toEqual({ success: false, reason: "corrupt" });

      // 5. Confirm the previous last-known compatibility flag remains true
      expect(hasUnsupportedStorageVersion()).toBe(true);
    });

    it("Check B: v2 -> inaccessible retains the last-confirmed flag", () => {
      // 1. Read a valid v2 payload
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      const initialRead = safeReadPersonalStorage(window.localStorage);
      expect(initialRead).toEqual({ success: false, reason: "unsupported_version" });

      // 2. Confirm helper returns true
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 3. Make getItem() throw to simulate inaccessible storage
      const throwingStorage = {
        getItem: () => {
          throw new DOMException("Simulated read failure", "SecurityError");
        },
      } as unknown as Storage;

      // 4. Confirm result is inaccessible
      const inaccessibleRead = safeReadPersonalStorage(throwingStorage);
      expect(inaccessibleRead).toEqual({ success: false, reason: "inaccessible" });

      // 5. Confirm the last-confirmed flag remains true
      expect(hasUnsupportedStorageVersion()).toBe(true);
    });

    it("Check C: v2 -> corrupt -> successful healing resets the flag to false", () => {
      // 1. Confirm v2 payload sets the flag to true
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Replace disk contents with malformed JSON
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, "{ corrupt syntax that cannot parse");
      const corruptRead = safeReadPersonalStorage(window.localStorage);
      expect(corruptRead).toEqual({ success: false, reason: "corrupt" });
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 3. Perform a valid v1 write
      const writeResult = writePersonalStorage(v1State);

      // 4. Verify healing succeeds, disk contains valid v1 data, and flag becomes false
      expect(writeResult).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);

      const diskRaw = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
      expect(diskRaw).not.toBeNull();
      const parsed = JSON.parse(diskRaw!);
      expect(parsed.version).toBe(CURRENT_STORAGE_VERSION);
      expect(parsed.movies["m_local"]?.id).toBe("m_local");
      expect(hasPersonalSessionMutations()).toBe(false);
    });
  });

  describe("Phase 6.11.8.4: Synchronize Compatibility Cache During Write Preflight", () => {
    const v2PayloadString = JSON.stringify({
      version: 2,
      schemaVariant: "enterprise",
      movies: {
        m_future: {
          id: "m_future",
          snapshot: {
            id: "m_future",
            title: "Future Film 3000",
            year: 2050,
            rating: 9.9,
            posterUrl: "https://example.com/future.jpg",
            art: ["future_bg", "future_accent"],
            genres: ["Sci-Fi", "Time Travel"],
          },
          isFavorite: true,
          listStatus: "watched",
          personalRating: 10,
          customFutureField: { tier: "gold" },
          updatedAt: "2050-01-01T00:00:00.000Z",
        },
      },
      userCustomPreferences: { theme: "holographic" },
    });

    const v1State: PersonalStorageSchema = {
      version: CURRENT_STORAGE_VERSION,
      movies: {
        m_local: {
          id: "m_local",
          snapshot: {
            id: "m_local",
            title: "Local Movie",
            year: 2024,
            rating: 8.0,
            posterUrl: null,
            art: null,
            genres: ["Drama"],
          },
          isFavorite: true,
          listStatus: "watchlist",
          personalRating: 8.5,
          comments: [],
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    };

    beforeEach(() => {
      resetPersonalStorageCache();
      window.localStorage.clear();
    });

    it("Check A: v2 -> v0 preflight sync clears compatibility flag even when setItem() throws", () => {
      // 1. Establish v2 state in storage and confirm flag is true
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Storage is externally updated to v0 payload
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 0, movies: {} })
      );

      // 3. Mock setItem to throw (e.g. QuotaExceededError)
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

      // 4. Attempt a local write
      const writeResult = writePersonalStorage(v1State);

      // 5. Write returns false, session mutation is preserved, and flag is false
      expect(writeResult).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(getPersonalStorageSnapshot().movies["m_local"]?.id).toBe("m_local");
      expect(hasUnsupportedStorageVersion()).toBe(false);

      setItemSpy.mockRestore();
    });

    it("Check B: v2 -> v1 preflight sync clears compatibility flag even when setItem() throws", () => {
      // 1. Establish v2 state and confirm flag is true
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Storage is externally updated to v1 payload
      window.localStorage.setItem(
        PERSONAL_STORAGE_KEY,
        JSON.stringify({ version: 1, movies: {} })
      );

      // 3. Mock setItem to throw
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

      // 4. Attempt local write
      const writeResult = writePersonalStorage(v1State);

      // 5. Write returns false, but compatibility flag is cleared to false by preflight
      expect(writeResult).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);

      setItemSpy.mockRestore();
    });

    it("Check C: v2 -> missing key preflight sync clears compatibility flag even when setItem() throws", () => {
      // 1. Establish v2 state and confirm flag is true
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Storage key is deleted / missing
      window.localStorage.removeItem(PERSONAL_STORAGE_KEY);

      // 3. Mock setItem to throw
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

      // 4. Attempt local write
      const writeResult = writePersonalStorage(v1State);

      // 5. Preflight observes raw === null and resets flag to false
      expect(writeResult).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(false);

      setItemSpy.mockRestore();
    });

    it("Check D: v2 -> corrupt JSON retains the previous confirmed flag when setItem() throws", () => {
      // 1. Establish v2 state and confirm flag is true
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, v2PayloadString);
      safeReadPersonalStorage(window.localStorage);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      // 2. Storage is replaced with malformed JSON
      window.localStorage.setItem(PERSONAL_STORAGE_KEY, "{ damaged unparsable json syntax");

      // 3. Mock setItem to throw
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      });

      // 4. Attempt local write
      const writeResult = writePersonalStorage(v1State);

      // 5. Write returns false, and last confirmed observation (true) is retained
      expect(writeResult).toBe(false);
      expect(hasPersonalSessionMutations()).toBe(true);
      expect(hasUnsupportedStorageVersion()).toBe(true);

      setItemSpy.mockRestore();
    });
  });
});
