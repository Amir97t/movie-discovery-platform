import { describe, expect, it, beforeEach } from "vitest";
import {
  addCommentInStore,
  calculatePersonalStatistics,
  clearPersonalRatingInStore,
  createPersonalBackup,
  deleteCommentInStore,
  getInitialPersonalState,
  getPersonalStorageSnapshot,
  INITIAL_PERSONAL_STATE,
  isLocalStorageAvailable,
  isRecordEmpty,
  mergeImportedDataInStore,
  PERSONAL_STORAGE_KEY,
  readPersonalStorage,
  resetPersonalDataInStore,
  resetPersonalStorageCache,
  sanitizeSnapshot,
  setPersonalRatingInStore,
  sortLibraryMovies,
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
    resetPersonalStorageCache();
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
});
