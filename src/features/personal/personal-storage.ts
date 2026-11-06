import type {
  GenreCount,
  ImportPreviewSummary,
  ImportValidationResult,
  LibrarySortOption,
  MovieSnapshot,
  PersonalBackupV1,
  PersonalComment,
  PersonalProfile,
  PersonalRecord,
  PersonalStatistics,
  PersonalStorageSchema,
} from "./personal-types";

export const PERSONAL_STORAGE_KEY = "mdp_personal_v1";
export const PERSONAL_UPDATE_EVENT = "mdp:personal-updated";
export const CURRENT_STORAGE_VERSION = 1;
export const MAX_COMMENT_LENGTH = 1000;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_BIO_LENGTH = 280;
export const BACKUP_FORMAT_IDENTIFIER = "movie-discovery-platform-backup";

export const INITIAL_PERSONAL_STATE: Readonly<PersonalStorageSchema> = Object.freeze({
  version: CURRENT_STORAGE_VERSION,
  movies: Object.freeze({}),
});

let cachedSnapshot: PersonalStorageSchema | null = null;
let isStorageWorking = true;
const subscribers = new Set<() => void>();

export function resetPersonalStorageCache(): void {
  cachedSnapshot = null;
  isStorageWorking = true;
}

export function isPersonalStorageAvailable(
  storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null
): boolean {
  if (typeof window === "undefined") return true;
  if (!isStorageWorking) return false;
  return isLocalStorageAvailable(storage);
}

export function setPersonalStorageAvailable(available: boolean): void {
  isStorageWorking = available;
  subscribers.forEach((cb) => cb());
}

export function getInitialPersonalState(): PersonalStorageSchema {
  return INITIAL_PERSONAL_STATE as PersonalStorageSchema;
}

/**
 * Checks whether localStorage is available and writable in the current runtime environment.
 */
export function isLocalStorageAvailable(
  storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null
): boolean {
  if (!storage) return false;
  try {
    const testKey = "__mdp_storage_probe__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes and validates a movie snapshot object.
 */
export function sanitizeSnapshot(raw: unknown, defaultId: string): MovieSnapshot {
  if (!raw || typeof raw !== "object") {
    return {
      id: defaultId,
      title: "Untitled",
      year: null,
      rating: null,
      posterUrl: null,
      art: null,
      genres: [],
    };
  }

  const s = raw as Record<string, unknown>;
  const id = typeof s.id === "string" && s.id.trim() ? s.id.trim() : defaultId;
  const title = typeof s.title === "string" && s.title.trim() ? s.title.trim() : "Untitled";
  const year = typeof s.year === "number" && Number.isFinite(s.year) ? s.year : null;
  const rating = typeof s.rating === "number" && Number.isFinite(s.rating) ? s.rating : null;
  const posterUrl = typeof s.posterUrl === "string" ? s.posterUrl : null;
  const art =
    Array.isArray(s.art) && s.art.length === 2 && typeof s.art[0] === "string" && typeof s.art[1] === "string"
      ? ([s.art[0], s.art[1]] as const)
      : null;
  const genres = Array.isArray(s.genres)
    ? s.genres.filter((g): g is string => typeof g === "string")
    : [];

  return { id, title, year, rating, posterUrl, art, genres };
}

/**
 * Determines whether a personal record has zero active personal data.
 * Does NOT treat a valid rating of 0 as empty.
 * Treats an empty comments array as having no comments.
 */
export function isRecordEmpty(record: PersonalRecord): boolean {
  const hasFavorite = record.isFavorite === true;
  const hasStatus = record.listStatus === "watchlist" || record.listStatus === "watched";
  const hasRating = typeof record.personalRating === "number" && !Number.isNaN(record.personalRating);
  const hasComments = Array.isArray(record.comments) && record.comments.length > 0;

  return !hasFavorite && !hasStatus && !hasRating && !hasComments;
}

/**
 * Safely reads personal data from browser localStorage with strict schema validation.
 * Returns frozen initial state if storage is unavailable, empty, or corrupted.
 */
export function readPersonalStorage(
  storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null
): PersonalStorageSchema {
  if (!storage) return getInitialPersonalState();

  try {
    const raw = storage.getItem(PERSONAL_STORAGE_KEY);
    if (!raw) return getInitialPersonalState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return getInitialPersonalState();
    }

    if (parsed.version !== CURRENT_STORAGE_VERSION) {
      return getInitialPersonalState();
    }

    if (!parsed.movies || typeof parsed.movies !== "object" || Array.isArray(parsed.movies)) {
      return getInitialPersonalState();
    }

    const validMovies: Record<string, PersonalRecord> = {};
    for (const [key, item] of Object.entries(parsed.movies)) {
      if (!item || typeof item !== "object") continue;

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : key;
      const snapshot = sanitizeSnapshot(record.snapshot, id);

      const isFavorite = record.isFavorite === true;
      const listStatus =
        record.listStatus === "watchlist" || record.listStatus === "watched"
          ? record.listStatus
          : null;

      const personalRating =
        typeof record.personalRating === "number" && !Number.isNaN(record.personalRating)
          ? record.personalRating
          : null;

      const comments = Array.isArray(record.comments)
        ? record.comments.filter(
            (c): c is PersonalComment =>
              Boolean(c && typeof c === "object" && typeof c.id === "string" && typeof c.text === "string")
          )
        : [];

      const updatedAt =
        typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString();

      const candidate: PersonalRecord = {
        id,
        snapshot,
        isFavorite,
        listStatus,
        personalRating,
        comments,
        updatedAt,
      };

      if (!isRecordEmpty(candidate)) {
        validMovies[id] = candidate;
      }
    }

    return {
      version: CURRENT_STORAGE_VERSION,
      movies: validMovies,
      profile:
        parsed.profile && typeof parsed.profile === "object"
          ? {
              displayName: String(parsed.profile.displayName || ""),
              bio: String(parsed.profile.bio || ""),
            }
          : undefined,
    };
  } catch {
    return getInitialPersonalState();
  }
}

/**
 * Returns current cached snapshot for useSyncExternalStore.
 * Reference remains stable as long as the state has not changed.
 */
export function getPersonalStorageSnapshot(): PersonalStorageSchema {
  if (cachedSnapshot === null) {
    cachedSnapshot = readPersonalStorage();
  }
  return cachedSnapshot;
}

/**
 * Subscribes to changes in personal storage (same-tab and cross-tab).
 */
export function subscribePersonalStorage(callback: () => void): () => void {
  subscribers.add(callback);

  const handleUpdate = () => {
    cachedSnapshot = readPersonalStorage();
    callback();
  };

  if (typeof window !== "undefined") {
    window.addEventListener(PERSONAL_UPDATE_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);
  }

  return () => {
    subscribers.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener(PERSONAL_UPDATE_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    }
  };
}

/**
 * Safely persists personal state to localStorage and dispatches a synchronization event.
 * Returns true if persisted to storage; false if storage was unavailable (session-only memory state).
 */
export function writePersonalStorage(
  state: PersonalStorageSchema,
  storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null
): boolean {
  cachedSnapshot = state;

  if (!storage) {
    subscribers.forEach((cb) => cb());
    return false;
  }

  try {
    const serialized = JSON.stringify(state);
    storage.setItem(PERSONAL_STORAGE_KEY, serialized);
    isStorageWorking = true;

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(PERSONAL_UPDATE_EVENT, { detail: state })
      );
    }

    subscribers.forEach((cb) => cb());
    return true;
  } catch {
    // QuotaExceededError or security restriction (storage unavailable)
    isStorageWorking = false;
    subscribers.forEach((cb) => cb());
    return false;
  }
}

function cleanupRecordIfEmpty(
  record: PersonalRecord,
  id: string,
  movies: Record<string, PersonalRecord>
): void {
  if (isRecordEmpty(record)) {
    delete movies[id];
  }
}

/**
 * Toggles favorite status for a movie.
 * Favorites are independent of Watchlist and Watched status.
 */
export function toggleFavoriteInStore(
  state: PersonalStorageSchema,
  id: string,
  snapshot: MovieSnapshot
): PersonalStorageSchema {
  const nextMovies = { ...state.movies };
  const existing = nextMovies[id];
  const now = new Date().toISOString();

  if (existing) {
    const nextFavorite = !existing.isFavorite;
    const updated: PersonalRecord = {
      ...existing,
      snapshot: { ...existing.snapshot, ...sanitizeSnapshot(snapshot, id) },
      isFavorite: nextFavorite,
      updatedAt: now,
    };
    nextMovies[id] = updated;
    cleanupRecordIfEmpty(updated, id, nextMovies);
  } else {
    nextMovies[id] = {
      id,
      snapshot: sanitizeSnapshot(snapshot, id),
      isFavorite: true,
      listStatus: null,
      updatedAt: now,
    };
  }

  return {
    ...state,
    movies: nextMovies,
  };
}

/**
 * Toggles watchlist status for a movie.
 * Mutually exclusive with Watched: adding to Watchlist clears Watched.
 */
export function toggleWatchlistInStore(
  state: PersonalStorageSchema,
  id: string,
  snapshot: MovieSnapshot
): PersonalStorageSchema {
  const nextMovies = { ...state.movies };
  const existing = nextMovies[id];
  const now = new Date().toISOString();

  if (existing) {
    const nextStatus = existing.listStatus === "watchlist" ? null : "watchlist";
    const updated: PersonalRecord = {
      ...existing,
      snapshot: { ...existing.snapshot, ...sanitizeSnapshot(snapshot, id) },
      listStatus: nextStatus,
      updatedAt: now,
    };
    nextMovies[id] = updated;
    cleanupRecordIfEmpty(updated, id, nextMovies);
  } else {
    nextMovies[id] = {
      id,
      snapshot: sanitizeSnapshot(snapshot, id),
      isFavorite: false,
      listStatus: "watchlist",
      updatedAt: now,
    };
  }

  return {
    ...state,
    movies: nextMovies,
  };
}

/**
 * Toggles watched status for a movie.
 * Mutually exclusive with Watchlist: marking as Watched clears Watchlist.
 */
export function toggleWatchedInStore(
  state: PersonalStorageSchema,
  id: string,
  snapshot: MovieSnapshot
): PersonalStorageSchema {
  const nextMovies = { ...state.movies };
  const existing = nextMovies[id];
  const now = new Date().toISOString();

  if (existing) {
    const nextStatus = existing.listStatus === "watched" ? null : "watched";
    const updated: PersonalRecord = {
      ...existing,
      snapshot: { ...existing.snapshot, ...sanitizeSnapshot(snapshot, id) },
      listStatus: nextStatus,
      updatedAt: now,
    };
    nextMovies[id] = updated;
    cleanupRecordIfEmpty(updated, id, nextMovies);
  } else {
    nextMovies[id] = {
      id,
      snapshot: sanitizeSnapshot(snapshot, id),
      isFavorite: false,
      listStatus: "watched",
      updatedAt: now,
    };
  }

  return {
    ...state,
    movies: nextMovies,
  };
}

/**
 * Validates a rating value: must be a finite number between 0 and 10 inclusive,
 * divisible by 0.5. Rejects negative values, values > 10, non-multiples of 0.5, NaN, and Infinity.
 */
export function validatePersonalRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 10) return null;
  const doubled = value * 2;
  if (Math.abs(Math.round(doubled) - doubled) > 1e-9) {
    return null;
  }
  return Math.round(doubled) / 2;
}

/**
 * Sets personal rating for a movie (0–10 in 0.5 increments).
 * Independent of Favorites, Watchlist, Watched, or external ratings.
 */
export function setPersonalRatingInStore(
  state: PersonalStorageSchema,
  id: string,
  snapshot: MovieSnapshot,
  rawRating: number
): PersonalStorageSchema {
  const validRating = validatePersonalRating(rawRating);
  if (validRating === null) return state;

  const nextMovies = { ...state.movies };
  const existing = nextMovies[id];
  const now = new Date().toISOString();

  if (existing) {
    const updated: PersonalRecord = {
      ...existing,
      snapshot: { ...existing.snapshot, ...sanitizeSnapshot(snapshot, id) },
      personalRating: validRating,
      updatedAt: now,
    };
    nextMovies[id] = updated;
  } else {
    nextMovies[id] = {
      id,
      snapshot: sanitizeSnapshot(snapshot, id),
      isFavorite: false,
      listStatus: null,
      personalRating: validRating,
      comments: [],
      updatedAt: now,
    };
  }

  return { ...state, movies: nextMovies };
}

/**
 * Clears personal rating for a movie.
 * Prunes the record only if no other personal data exists.
 */
export function clearPersonalRatingInStore(
  state: PersonalStorageSchema,
  id: string
): PersonalStorageSchema {
  const nextMovies = { ...state.movies };
  const existing = nextMovies[id];
  if (!existing) return state;

  const now = new Date().toISOString();
  const updated: PersonalRecord = {
    ...existing,
    personalRating: null,
    updatedAt: now,
  };
  nextMovies[id] = updated;
  cleanupRecordIfEmpty(updated, id, nextMovies);

  return { ...state, movies: nextMovies };
}

/**
 * Adds a local comment to a movie record.
 * Generates/sanitizes text, enforces max 1,000 characters, and prevents duplicates.
 */
export function addCommentInStore(
  state: PersonalStorageSchema,
  id: string,
  snapshot: MovieSnapshot,
  comment: PersonalComment
): PersonalStorageSchema {
  const trimmed = comment.text.trim();
  if (!trimmed) return state;
  const sanitizedText = trimmed.length > MAX_COMMENT_LENGTH ? trimmed.slice(0, MAX_COMMENT_LENGTH) : trimmed;

  const validComment: PersonalComment = {
    id: comment.id,
    text: sanitizedText,
    createdAt: comment.createdAt || new Date().toISOString(),
  };

  const nextMovies = { ...state.movies };
  const existing = nextMovies[id];
  const now = new Date().toISOString();

  if (existing) {
    const existingComments = Array.isArray(existing.comments) ? existing.comments : [];
    if (existingComments.some((c) => c.id === validComment.id)) {
      return state;
    }
    const updated: PersonalRecord = {
      ...existing,
      snapshot: { ...existing.snapshot, ...sanitizeSnapshot(snapshot, id) },
      comments: [validComment, ...existingComments],
      updatedAt: now,
    };
    nextMovies[id] = updated;
  } else {
    nextMovies[id] = {
      id,
      snapshot: sanitizeSnapshot(snapshot, id),
      isFavorite: false,
      listStatus: null,
      personalRating: null,
      comments: [validComment],
      updatedAt: now,
    };
  }

  return { ...state, movies: nextMovies };
}

/**
 * Deletes a comment by commentId from a movie's record.
 * Prunes the movie record if all other personal data is empty.
 */
export function deleteCommentInStore(
  state: PersonalStorageSchema,
  movieId: string,
  commentId: string
): PersonalStorageSchema {
  const nextMovies = { ...state.movies };
  const existing = nextMovies[movieId];
  if (!existing) return state;

  const existingComments = Array.isArray(existing.comments) ? existing.comments : [];
  const filteredComments = existingComments.filter((c) => c.id !== commentId);

  if (filteredComments.length === existingComments.length) {
    return state;
  }

  const now = new Date().toISOString();
  const updated: PersonalRecord = {
    ...existing,
    comments: filteredComments,
    updatedAt: now,
  };
  nextMovies[movieId] = updated;
  cleanupRecordIfEmpty(updated, movieId, nextMovies);

  return { ...state, movies: nextMovies };
}

/**
 * Updates or clears personal profile information (display name and bio).
 */
export function updateProfileInStore(
  state: PersonalStorageSchema,
  profile: { displayName: string; bio: string }
): PersonalStorageSchema {
  const trimmedName = profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  const trimmedBio = profile.bio.trim().slice(0, MAX_BIO_LENGTH);

  return {
    ...state,
    profile: {
      displayName: trimmedName,
      bio: trimmedBio,
    },
  };
}

/**
 * Computes live derived personal statistics from stored records without duplicate counters.
 * - Counts Favorites, Watchlist, and Watched independently.
 * - Counts 0 as a valid rating, including it in the average calculation.
 * - Calculates genre breakdown from favorited movies only.
 */
export function calculatePersonalStatistics(
  state: PersonalStorageSchema
): PersonalStatistics {
  let favoritesCount = 0;
  let watchlistCount = 0;
  let watchedCount = 0;
  let ratedCount = 0;
  let ratingSum = 0;
  let totalCommentsCount = 0;
  const genreCounts: Record<string, number> = {};

  for (const record of Object.values(state.movies)) {
    if (record.isFavorite) {
      favoritesCount++;
      if (record.snapshot && Array.isArray(record.snapshot.genres)) {
        for (const genre of record.snapshot.genres) {
          if (typeof genre === "string" && genre.trim()) {
            const g = genre.trim();
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          }
        }
      }
    }

    if (record.listStatus === "watchlist") {
      watchlistCount++;
    } else if (record.listStatus === "watched") {
      watchedCount++;
    }

    if (typeof record.personalRating === "number" && !Number.isNaN(record.personalRating)) {
      ratedCount++;
      ratingSum += record.personalRating;
    }

    if (Array.isArray(record.comments)) {
      totalCommentsCount += record.comments.length;
    }
  }

  const averageRating = ratedCount > 0 ? ratingSum / ratedCount : null;

  const favoriteGenres: GenreCount[] = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));

  return {
    favoritesCount,
    watchlistCount,
    watchedCount,
    ratedCount,
    averageRating,
    totalCommentsCount,
    favoriteGenres,
  };
}

/**
 * Sorts an array of personal records deterministically.
 */
export function sortLibraryMovies(
  records: PersonalRecord[],
  sortBy: LibrarySortOption
): PersonalRecord[] {
  return [...records].sort((a, b) => {
    if (sortBy === "recently-updated") {
      const timeA = new Date(a.updatedAt).getTime() || 0;
      const timeB = new Date(b.updatedAt).getTime() || 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.snapshot.title.localeCompare(b.snapshot.title);
    }
    if (sortBy === "title-asc") {
      return a.snapshot.title.localeCompare(b.snapshot.title);
    }
    if (sortBy === "year-desc") {
      const yearA = a.snapshot.year ?? -1;
      const yearB = b.snapshot.year ?? -1;
      if (yearB !== yearA) return yearB - yearA;
      return a.snapshot.title.localeCompare(b.snapshot.title);
    }
    if (sortBy === "rating-desc") {
      const ratingA = a.snapshot.rating ?? -1;
      const ratingB = b.snapshot.rating ?? -1;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return a.snapshot.title.localeCompare(b.snapshot.title);
    }
    return 0;
  });
}

/**
 * Generates an export payload object for backup download.
 */
export function createPersonalBackup(
  state: PersonalStorageSchema
): PersonalBackupV1 {
  return {
    format: BACKUP_FORMAT_IDENTIFIER,
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: state.profile ? { ...state.profile } : undefined,
    movies: { ...state.movies },
  };
}

/**
 * Validates an unknown raw import object against the backup schema.
 * Rejects corrupt, oversized, or invalid structure completely.
 */
export function validateImportPayload(raw: unknown): ImportValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Invalid backup file: not a JSON object." };
  }

  const candidate = raw as Record<string, unknown>;

  if (candidate.format !== BACKUP_FORMAT_IDENTIFIER) {
    return {
      success: false,
      error: `Unsupported backup format. Expected "${BACKUP_FORMAT_IDENTIFIER}".`,
    };
  }

  if (candidate.version !== 1) {
    return {
      success: false,
      error: `Unsupported schema version: ${candidate.version}. Expected version 1.`,
    };
  }

  if (!candidate.movies || typeof candidate.movies !== "object" || Array.isArray(candidate.movies)) {
    return { success: false, error: "Invalid backup: 'movies' object is missing or malformed." };
  }

  const rawMovies = candidate.movies as Record<string, unknown>;
  const movieCount = Object.keys(rawMovies).length;
  if (movieCount > 5000) {
    return { success: false, error: "Backup exceeds maximum supported limit (5,000 titles)." };
  }

  let profile: PersonalProfile | undefined = undefined;
  if (candidate.profile) {
    if (typeof candidate.profile !== "object" || Array.isArray(candidate.profile)) {
      return { success: false, error: "Invalid profile data in backup file." };
    }
    const rawProfile = candidate.profile as Record<string, unknown>;
    profile = {
      displayName: typeof rawProfile.displayName === "string" ? rawProfile.displayName.slice(0, MAX_DISPLAY_NAME_LENGTH) : "",
      bio: typeof rawProfile.bio === "string" ? rawProfile.bio.slice(0, MAX_BIO_LENGTH) : "",
    };
  }

  const validatedMovies: Record<string, PersonalRecord> = {};
  let favoritesCount = 0;
  let watchlistCount = 0;
  let watchedCount = 0;
  let ratedCount = 0;
  let commentsCount = 0;

  for (const [key, item] of Object.entries(rawMovies)) {
    if (!item || typeof item !== "object") {
      return { success: false, error: `Invalid movie entry for ID "${key}".` };
    }

    const m = item as Record<string, unknown>;
    const id = typeof m.id === "string" && m.id.trim() ? m.id.trim() : key;
    const isFavorite = m.isFavorite === true;

    let listStatus: "watchlist" | "watched" | null = null;
    if (m.listStatus === "watchlist" || m.listStatus === "watched") {
      listStatus = m.listStatus;
    }

    let personalRating: number | null = null;
    if (m.personalRating !== undefined && m.personalRating !== null) {
      const validatedRating = validatePersonalRating(m.personalRating);
      if (validatedRating === null) {
        return {
          success: false,
          error: `Invalid rating value for movie "${id}". Ratings must be numbers between 0 and 10 divisible by 0.5.`,
        };
      }
      personalRating = validatedRating;
    }

    const comments: PersonalComment[] = [];
    if (Array.isArray(m.comments)) {
      for (const c of m.comments) {
        if (!c || typeof c !== "object") {
          return { success: false, error: `Invalid comment object in movie "${id}".` };
        }
        const commentObj = c as Record<string, unknown>;
        if (typeof commentObj.id !== "string" || !commentObj.id.trim()) {
          return { success: false, error: `Comment missing ID in movie "${id}".` };
        }
        if (typeof commentObj.text !== "string" || !commentObj.text.trim()) {
          return { success: false, error: `Comment text missing in movie "${id}".` };
        }
        if (commentObj.text.length > MAX_COMMENT_LENGTH) {
          return { success: false, error: `Comment in movie "${id}" exceeds ${MAX_COMMENT_LENGTH} characters.` };
        }
        comments.push({
          id: commentObj.id.trim(),
          text: commentObj.text.trim(),
          createdAt:
            typeof commentObj.createdAt === "string" && commentObj.createdAt.trim()
              ? commentObj.createdAt
              : new Date().toISOString(),
        });
      }
    }

    const updatedAt =
      typeof m.updatedAt === "string" && m.updatedAt.trim()
        ? m.updatedAt
        : new Date().toISOString();

    const snapshot = sanitizeSnapshot(m.snapshot, id);

    const record: PersonalRecord = {
      id,
      snapshot,
      isFavorite,
      listStatus,
      personalRating,
      comments: comments.length > 0 ? comments : undefined,
      updatedAt,
    };

    if (!isRecordEmpty(record)) {
      validatedMovies[id] = record;
      if (isFavorite) favoritesCount++;
      if (listStatus === "watchlist") watchlistCount++;
      if (listStatus === "watched") watchedCount++;
      if (personalRating !== null) ratedCount++;
      commentsCount += comments.length;
    }
  }

  const validBackup: PersonalBackupV1 = {
    format: BACKUP_FORMAT_IDENTIFIER,
    version: 1,
    exportedAt:
      typeof candidate.exportedAt === "string" && candidate.exportedAt.trim()
        ? candidate.exportedAt
        : new Date().toISOString(),
    profile,
    movies: validatedMovies,
  };

  const summary: ImportPreviewSummary = {
    moviesCount: Object.keys(validatedMovies).length,
    favoritesCount,
    watchlistCount,
    watchedCount,
    ratedCount,
    commentsCount,
    hasProfile: Boolean(profile && (profile.displayName || profile.bio)),
    profileDisplayName: profile?.displayName || undefined,
  };

  return {
    success: true,
    data: validBackup,
    summary,
  };
}

function parseTimestampSafe(iso: unknown): number | null {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Merges a validated backup into current personal state.
 * - Favorites: union of current and imported favorite flags.
 * - Watchlist/Watched: deterministic conflict resolution by validated updatedAt timestamp:
 *     * Newer timestamp wins.
 *     * If one timestamp is invalid, the valid timestamp wins.
 *     * Deterministic tie rule (equal timestamps or both invalid): "watched" wins over "watchlist".
 * - Personal ratings: imported value takes precedence for matching IDs if specified.
 * - Comments: merged by unique comment ID (no duplicates).
 * - Profile: imported profile applied if non-empty.
 */
export function mergeImportedDataInStore(
  currentState: PersonalStorageSchema,
  backup: PersonalBackupV1
): PersonalStorageSchema {
  const mergedMovies: Record<string, PersonalRecord> = { ...currentState.movies };

  for (const [id, importedRecord] of Object.entries(backup.movies)) {
    const existing = mergedMovies[id];
    if (!existing) {
      mergedMovies[id] = { ...importedRecord };
      continue;
    }

    // 1. Favorites union
    const isFavorite = existing.isFavorite || importedRecord.isFavorite;

    // 2. Watchlist/Watched conflict resolution by validated timestamp
    let listStatus = existing.listStatus;
    if (importedRecord.listStatus && !existing.listStatus) {
      listStatus = importedRecord.listStatus;
    } else if (importedRecord.listStatus && existing.listStatus) {
      if (importedRecord.listStatus === existing.listStatus) {
        listStatus = existing.listStatus;
      } else {
        const existingTime = parseTimestampSafe(existing.updatedAt);
        const importedTime = parseTimestampSafe(importedRecord.updatedAt);

        if (existingTime !== null && importedTime !== null) {
          if (importedTime > existingTime) {
            listStatus = importedRecord.listStatus;
          } else if (existingTime > importedTime) {
            listStatus = existing.listStatus;
          } else {
            // Deterministic tie rule for exact equal timestamps:
            // "watched" takes precedence over "watchlist" because watched denotes completion
            listStatus =
              importedRecord.listStatus === "watched" || existing.listStatus === "watched"
                ? "watched"
                : importedRecord.listStatus;
          }
        } else if (importedTime !== null) {
          listStatus = importedRecord.listStatus;
        } else if (existingTime !== null) {
          listStatus = existing.listStatus;
        } else {
          // Both timestamps invalid/missing: deterministic tie rule
          listStatus =
            importedRecord.listStatus === "watched" || existing.listStatus === "watched"
              ? "watched"
              : importedRecord.listStatus;
        }
      }
    }

    // 3. Personal rating: imported value takes precedence if defined
    let personalRating = existing.personalRating;
    if (importedRecord.personalRating !== undefined && importedRecord.personalRating !== null) {
      personalRating = importedRecord.personalRating;
    }

    // 4. Comments: merge by unique ID
    const existingComments = Array.isArray(existing.comments) ? existing.comments : [];
    const importedComments = Array.isArray(importedRecord.comments) ? importedRecord.comments : [];
    const commentMap = new Map<string, PersonalComment>();
    for (const c of existingComments) {
      commentMap.set(c.id, c);
    }
    for (const c of importedComments) {
      commentMap.set(c.id, c);
    }
    const mergedComments = Array.from(commentMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // 5. Snapshot: prefer imported if complete
    const mergedSnapshot = {
      ...existing.snapshot,
      ...importedRecord.snapshot,
    };

    const existingTime = parseTimestampSafe(existing.updatedAt) ?? 0;
    const importedTime = parseTimestampSafe(importedRecord.updatedAt) ?? 0;
    const maxTime = Math.max(existingTime, importedTime);
    const updatedAt = maxTime > 0 ? new Date(maxTime).toISOString() : new Date().toISOString();

    const mergedRecord: PersonalRecord = {
      id,
      snapshot: mergedSnapshot,
      isFavorite,
      listStatus,
      personalRating,
      comments: mergedComments.length > 0 ? mergedComments : undefined,
      updatedAt,
    };

    if (!isRecordEmpty(mergedRecord)) {
      mergedMovies[id] = mergedRecord;
    } else {
      delete mergedMovies[id];
    }
  }

  // Profile merge
  let profile = currentState.profile;
  if (backup.profile && (backup.profile.displayName || backup.profile.bio)) {
    profile = { ...backup.profile };
  }

  return {
    version: CURRENT_STORAGE_VERSION,
    movies: mergedMovies,
    profile,
  };
}

/**
 * Resets personal data completely back to empty initial state.
 * Leaves unrelated localStorage entries (e.g. appearance, language) untouched.
 */
export function resetPersonalDataInStore(): PersonalStorageSchema {
  return {
    version: CURRENT_STORAGE_VERSION,
    movies: {},
    profile: undefined,
  };
}
