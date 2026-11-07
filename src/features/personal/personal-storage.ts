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
export const STORAGE_PROBE_KEY = "__mdp_storage_probe__";
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
let cachedAvailability: boolean = true;
let cachedUnsupportedVersion = false;
let windowListenersAttached = false;
let isWriting = false;
let hasSessionMutations = false;
let sessionBaseSnapshot: PersonalStorageSchema | null = null;
let latestRemoteSnapshot: PersonalStorageSchema | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers(): void {
  subscribers.forEach((cb) => cb());
}

/**
 * Safely accesses window.localStorage without throwing SecurityError in restricted environments.
 */
export function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the currently active Base snapshot captured before the first failed session write.
 * Null when no unsaved session mutations are pending.
 */
export function getSessionBaseSnapshot(): PersonalStorageSchema | null {
  return sessionBaseSnapshot;
}

/**
 * Returns the latest accepted remote state snapshot during pending session mutations.
 * Null when no unsaved session mutations are pending.
 */
export function getLatestRemoteSnapshot(): PersonalStorageSchema | null {
  return latestRemoteSnapshot;
}

/**
 * Test isolation utility only. Resets in-memory cached state, clears all active
 * subscribers, and unregisters window event listeners.
 * Not intended for use in production application runtime.
 */
export function resetPersonalStorageCache(): void {
  isWriting = false;
  hasSessionMutations = false;
  sessionBaseSnapshot = null;
  latestRemoteSnapshot = null;
  cachedSnapshot = null;
  cachedAvailability = typeof window === "undefined" ? true : getSafeLocalStorage() !== null;
  cachedUnsupportedVersion = false;
  subscribers.clear();
  if (typeof window !== "undefined" && windowListenersAttached) {
    window.removeEventListener(PERSONAL_UPDATE_EVENT, onCustomEvent);
    window.removeEventListener("storage", onStorageEvent);
    windowListenersAttached = false;
  }
}

/**
 * Pure, side-effect-free snapshot getter for useSyncExternalStore.
 * Returns cached availability state without modifying storage or causing cross-tab events.
 */
export function isPersonalStorageAvailable(): boolean {
  if (typeof window === "undefined") return true;
  return cachedAvailability;
}

/**
 * Returns whether there are unsaved/session-only local personal mutations pending persistence.
 */
export function hasPersonalSessionMutations(): boolean {
  return hasSessionMutations;
}

/**
 * Reports the most recently confirmed schema compatibility state (e.g. version > 1).
 * When true, writes are blocked from overwriting disk to prevent forward-compatibility data loss.
 *
 * Cache Semantics (Last-Confirmed-Observation Policy):
 * - Confirmed newer numeric version (version > CURRENT_STORAGE_VERSION): sets to true.
 * - Confirmed current or older numeric version (version <= CURRENT_STORAGE_VERSION): sets to false.
 * - Confirmed missing or cleared key (null payload): resets to false.
 * - Corrupt or inaccessible payload: retains the previously confirmed observation, because
 *   unreadable content does not establish a new verified schema version.
 * - Successful write of current schema (e.g. initial write or healing corrupt disk data): resets to false.
 */
export function hasUnsupportedStorageVersion(): boolean {
  return cachedUnsupportedVersion;
}

/**
 * Determines whether a personal storage state contains any non-empty user data (movies or profile).
 */
export function hasPersonalData(state: PersonalStorageSchema | null | undefined): boolean {
  if (!state) return false;
  if (Object.keys(state.movies).length > 0) return true;
  if (state.profile) {
    const name = state.profile.displayName?.trim();
    const bio = state.profile.bio?.trim();
    if (name || bio) return true;
  }
  return false;
}

/**
 * Updates cached availability and notifies subscribers only when the state actually changes
 * and not during an active write operation (which notifies once upon completion).
 */
export function setPersonalStorageAvailable(available: boolean): void {
  if (cachedAvailability === available) return;
  cachedAvailability = available;
  if (!isWriting) {
    notifySubscribers();
  }
}

export function getInitialPersonalState(): PersonalStorageSchema {
  return INITIAL_PERSONAL_STATE as PersonalStorageSchema;
}

/**
 * Checks whether localStorage is available and writable in the current runtime environment.
 * Uses a safe probe key outside snapshot getters.
 */
export function isLocalStorageAvailable(
  storage: Storage | null = getSafeLocalStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_PROBE_KEY, "1");
    storage.removeItem(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Actively checks storage availability and updates cached availability state.
 * Called outside snapshot getters (e.g., during subscription initialization or write recovery).
 *
 * Recovery Policy:
 * - When storage becomes accessible again and NO session-only mutations have occurred,
 *   loads the persisted data into cachedSnapshot so the store does not remain stuck
 *   with an empty fallback state.
 * - Detects meaningful persisted data across both movies and profile.
 * - If session-only mutations are pending when storage recovers, safely reads persisted
 *   data from disk and performs a three-way merge (session base vs cached snapshot vs disk)
 *   to incorporate concurrent remote additions and snapshot updates while preserving
 *   pending local mutations.
 * - Guarantees exactly one subscriber notification when availability or data changes.
 */
export function checkPersonalStorageAvailability(
  storage: Storage | null = getSafeLocalStorage()
): boolean {
  if (typeof window === "undefined") return true;
  if (!storage) {
    setPersonalStorageAvailable(false);
    return false;
  }

  const probeAvailable = isLocalStorageAvailable(storage);
  if (!probeAvailable) {
    setPersonalStorageAvailable(false);
    return false;
  }

  const readResult = safeReadPersonalStorage(storage);
  if (!readResult.success) {
    if (readResult.reason === "inaccessible") {
      setPersonalStorageAvailable(false);
      return false;
    }
    // Storage probe succeeded, but persisted data is corrupt or unsupported version.
    // The storage API itself is available, but the invalid payload must not
    // overwrite or merge into the valid in-memory snapshot.
    if (!cachedAvailability) {
      setPersonalStorageAvailable(true);
    }
    return true;
  }

  let snapshotChanged = false;

  if (hasSessionMutations && cachedSnapshot !== null) {
    const remoteBaseline = latestRemoteSnapshot ?? sessionBaseSnapshot ?? getInitialPersonalState();
    const hasRemoteChanges = !latestRemoteSnapshot || !areStatesEqual(latestRemoteSnapshot, readResult.data);
    if (hasRemoteChanges) {
      cachedSnapshot = threeWayMergePersonalStates(
        remoteBaseline,
        cachedSnapshot,
        readResult.data
      );
      latestRemoteSnapshot = readResult.data;
      snapshotChanged = true;
    }
  } else if (!hasSessionMutations) {
    const wasUnavailable = !cachedAvailability;
    const hadEmptySnapshotWithPersistedData =
      cachedSnapshot !== null &&
      !hasPersonalData(cachedSnapshot) &&
      hasPersonalData(readResult.data);

    if (wasUnavailable || hadEmptySnapshotWithPersistedData) {
      cachedSnapshot = readResult.data;
      snapshotChanged = true;
    }
  }

  if (!cachedAvailability) {
    setPersonalStorageAvailable(true);
  } else if (snapshotChanged) {
    notifySubscribers();
  }
  return true;
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

export type SafeReadFailureReason = "inaccessible" | "corrupt" | "unsupported_version";

export type SafeReadResult =
  | { success: true; data: PersonalStorageSchema }
  | { success: false; reason: SafeReadFailureReason };

/**
 * Safely reads and validates personal data from storage.
 * Distinguishes among:
 * - Valid persisted data (including legitimate absent/cleared key)
 * - Inaccessible storage (storage null, getter or getItem throwing)
 * - Malformed or corrupt persisted data
 * - Unsupported storage schema versions
 */
export function safeReadPersonalStorage(
  storage: Storage | null = getSafeLocalStorage()
): SafeReadResult {
  if (!storage) {
    return { success: false, reason: "inaccessible" };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(PERSONAL_STORAGE_KEY);
  } catch {
    return { success: false, reason: "inaccessible" };
  }

  // getItem() === null represents a valid empty storage state (uninitialized or cleared)
  if (raw === null) {
    cachedUnsupportedVersion = false;
    return { success: true, data: getInitialPersonalState() };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, reason: "corrupt" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { success: false, reason: "corrupt" };
  }

  const root = parsed as Record<string, unknown>;

  // Check version field
  if (typeof root.version !== "number") {
    return { success: false, reason: "corrupt" };
  }

  if (root.version !== CURRENT_STORAGE_VERSION) {
    cachedUnsupportedVersion = root.version > CURRENT_STORAGE_VERSION;
    return { success: false, reason: "unsupported_version" };
  }

  cachedUnsupportedVersion = false;

  // Validate movies container
  if (!root.movies || typeof root.movies !== "object" || Array.isArray(root.movies)) {
    return { success: false, reason: "corrupt" };
  }

  const validMovies: Record<string, PersonalRecord> = {};
  for (const [key, item] of Object.entries(root.movies as Record<string, unknown>)) {
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
    success: true,
    data: {
      version: CURRENT_STORAGE_VERSION,
      movies: validMovies,
      profile:
        root.profile && typeof root.profile === "object"
          ? {
              displayName: String((root.profile as Record<string, unknown>).displayName || ""),
              bio: String((root.profile as Record<string, unknown>).bio || ""),
            }
          : undefined,
    },
  };
}

/**
 * Safely reads personal data from browser localStorage with strict schema validation.
 * Pure snapshot reader: does not mutate availability state or notify subscribers.
 * Returns in-memory cached snapshot (if present) or frozen initial state if storage is inaccessible.
 */
export function readPersonalStorage(
  storage: Storage | null = getSafeLocalStorage()
): PersonalStorageSchema {
  const result = safeReadPersonalStorage(storage);
  if (!result.success) {
    return cachedSnapshot ?? getInitialPersonalState();
  }
  return result.data;
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

function parseTimestampSafe(iso: unknown): number | null {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Compares two art tuples for structural equality.
 */
export function areArtEqual(
  a: readonly [string, string] | null | undefined,
  b: readonly [string, string] | null | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Compares two genre arrays for structural equality.
 */
export function areGenresEqual(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined
): boolean {
  const arrA = a ?? [];
  const arrB = b ?? [];
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) return false;
  }
  return true;
}

/**
 * Compares two movie snapshots for structural and value equality across all snapshot fields:
 * id, title, year, rating, posterUrl, art, and genres.
 * Handles nullable and optional values consistently without reference identity shortcuts.
 */
export function areSnapshotsEqual(
  a: MovieSnapshot | null | undefined,
  b: MovieSnapshot | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const aId = typeof a.id === "string" ? a.id : "";
  const bId = typeof b.id === "string" ? b.id : "";
  if (aId !== bId) return false;

  const aTitle = typeof a.title === "string" ? a.title : "";
  const bTitle = typeof b.title === "string" ? b.title : "";
  if (aTitle !== bTitle) return false;

  const aYear = typeof a.year === "number" && Number.isFinite(a.year) ? a.year : null;
  const bYear = typeof b.year === "number" && Number.isFinite(b.year) ? b.year : null;
  if (aYear !== bYear) return false;

  const aRating = typeof a.rating === "number" && Number.isFinite(a.rating) ? a.rating : null;
  const bRating = typeof b.rating === "number" && Number.isFinite(b.rating) ? b.rating : null;
  if (aRating !== bRating) return false;

  const aPoster = typeof a.posterUrl === "string" && a.posterUrl.length > 0 ? a.posterUrl : null;
  const bPoster = typeof b.posterUrl === "string" && b.posterUrl.length > 0 ? b.posterUrl : null;
  if (aPoster !== bPoster) return false;

  if (!areArtEqual(a.art, b.art)) return false;
  if (!areGenresEqual(a.genres, b.genres)) return false;

  return true;
}

/**
 * Compares two personal records for structural and value equality across snapshot and user-editable fields.
 * Includes deep structural comparison of snapshot metadata (id, title, year, rating, posterUrl, art, genres).
 * Comment comparison is order-insensitive by comment id, text, and createdAt.
 */
export function areRecordsEqual(a: PersonalRecord, b: PersonalRecord): boolean {
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (!areSnapshotsEqual(a.snapshot, b.snapshot)) return false;
  if ((a.isFavorite === true) !== (b.isFavorite === true)) return false;
  const aStatus = a.listStatus === "watchlist" || a.listStatus === "watched" ? a.listStatus : null;
  const bStatus = b.listStatus === "watchlist" || b.listStatus === "watched" ? b.listStatus : null;
  if (aStatus !== bStatus) return false;

  const aRating = typeof a.personalRating === "number" && !Number.isNaN(a.personalRating) ? a.personalRating : null;
  const bRating = typeof b.personalRating === "number" && !Number.isNaN(b.personalRating) ? b.personalRating : null;
  if (aRating !== bRating) return false;

  const aComments = Array.isArray(a.comments) ? a.comments : [];
  const bComments = Array.isArray(b.comments) ? b.comments : [];
  if (aComments.length !== bComments.length) return false;

  if (aComments.length > 0) {
    const aMap = new Map<string, PersonalComment[]>();
    for (const c of aComments) {
      const list = aMap.get(c.id);
      if (list) {
        list.push(c);
      } else {
        aMap.set(c.id, [c]);
      }
    }

    const bMap = new Map<string, PersonalComment[]>();
    for (const c of bComments) {
      const list = bMap.get(c.id);
      if (list) {
        list.push(c);
      } else {
        bMap.set(c.id, [c]);
      }
    }

    if (aMap.size !== bMap.size) return false;

    for (const [id, aList] of aMap.entries()) {
      const bList = bMap.get(id);
      if (!bList || bList.length !== aList.length) return false;
      if (aList.length === 1) {
        if (aList[0].text !== bList[0].text || aList[0].createdAt !== bList[0].createdAt) {
          return false;
        }
      } else {
        const sortFn = (x: PersonalComment, y: PersonalComment) =>
          x.text.localeCompare(y.text) || x.createdAt.localeCompare(y.createdAt);
        const sortedA = [...aList].sort(sortFn);
        const sortedB = [...bList].sort(sortFn);
        for (let j = 0; j < sortedA.length; j++) {
          if (sortedA[j].text !== sortedB[j].text || sortedA[j].createdAt !== sortedB[j].createdAt) {
            return false;
          }
        }
      }
    }
  }

  return true;
}

/**
 * Compares two personal storage schemas for structural and value equality across user-editable fields.
 */
export function areStatesEqual(
  a: PersonalStorageSchema | null | undefined,
  b: PersonalStorageSchema | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.version !== b.version) return false;

  const aMovieKeys = Object.keys(a.movies);
  const bMovieKeys = Object.keys(b.movies);
  if (aMovieKeys.length !== bMovieKeys.length) return false;

  for (const id of aMovieKeys) {
    const aRec = a.movies[id];
    const bRec = b.movies[id];
    if (!aRec || !bRec) return false;
    if (!areRecordsEqual(aRec, bRec)) return false;
  }

  const aProfileName = a.profile?.displayName ?? "";
  const bProfileName = b.profile?.displayName ?? "";
  const aProfileBio = a.profile?.bio ?? "";
  const bProfileBio = b.profile?.bio ?? "";

  if (aProfileName !== bProfileName || aProfileBio !== bProfileBio) {
    return false;
  }

  return true;
}

/**
 * Field-level three-way merge for movie snapshot metadata.
 * Compares Base against Local and Remote for each field:
 * - If only Local changed it from Base, retain Local.
 * - If only Remote changed it from Base, accept Remote.
 * - If both changed to the same value, retain that value.
 * - If both changed differently, prefer Local.
 * - Explicit null/undefined and array equality handling.
 */
export function threeWayMergeMovieSnapshot(
  baseSnap: MovieSnapshot | undefined,
  localSnap: MovieSnapshot | undefined,
  remoteSnap: MovieSnapshot | undefined,
  defaultId: string
): MovieSnapshot {
  // 1. Title
  const baseTitle = baseSnap?.title;
  const localTitle = localSnap?.title;
  const remoteTitle = remoteSnap?.title;
  let title: string;
  if (localTitle !== baseTitle && remoteTitle === baseTitle) {
    title = localTitle ?? "Untitled";
  } else if (remoteTitle !== baseTitle && localTitle === baseTitle) {
    title = remoteTitle ?? "Untitled";
  } else if (localTitle !== baseTitle && remoteTitle !== baseTitle) {
    title = (localTitle === remoteTitle ? localTitle : localTitle) ?? "Untitled";
  } else {
    title = localTitle ?? remoteTitle ?? baseTitle ?? "Untitled";
  }

  // 2. Year
  const baseYear = baseSnap?.year ?? null;
  const localYear = localSnap?.year ?? null;
  const remoteYear = remoteSnap?.year ?? null;
  let year: number | null;
  if (localYear !== baseYear && remoteYear === baseYear) {
    year = localYear;
  } else if (remoteYear !== baseYear && localYear === baseYear) {
    year = remoteYear;
  } else if (localYear !== baseYear && remoteYear !== baseYear) {
    year = localYear === remoteYear ? localYear : localYear;
  } else {
    year = localYear ?? remoteYear ?? baseYear ?? null;
  }

  // 3. Rating
  const baseRating = baseSnap?.rating ?? null;
  const localRating = localSnap?.rating ?? null;
  const remoteRating = remoteSnap?.rating ?? null;
  let rating: number | null;
  if (localRating !== baseRating && remoteRating === baseRating) {
    rating = localRating;
  } else if (remoteRating !== baseRating && localRating === baseRating) {
    rating = remoteRating;
  } else if (localRating !== baseRating && remoteRating !== baseRating) {
    rating = localRating === remoteRating ? localRating : localRating;
  } else {
    rating = localRating ?? remoteRating ?? baseRating ?? null;
  }

  // 4. PosterUrl
  const basePoster = baseSnap?.posterUrl ?? null;
  const localPoster = localSnap?.posterUrl ?? null;
  const remotePoster = remoteSnap?.posterUrl ?? null;
  let posterUrl: string | null;
  if (localPoster !== basePoster && remotePoster === basePoster) {
    posterUrl = localPoster;
  } else if (remotePoster !== basePoster && localPoster === basePoster) {
    posterUrl = remotePoster;
  } else if (localPoster !== basePoster && remotePoster !== basePoster) {
    posterUrl = localPoster === remotePoster ? localPoster : localPoster;
  } else {
    posterUrl = localPoster ?? remotePoster ?? basePoster ?? null;
  }

  // 5. Art
  const baseArt = baseSnap?.art ?? null;
  const localArt = localSnap?.art ?? null;
  const remoteArt = remoteSnap?.art ?? null;
  const localArtChanged = !areArtEqual(localArt, baseArt);
  const remoteArtChanged = !areArtEqual(remoteArt, baseArt);
  let art: readonly [string, string] | null;
  if (localArtChanged && !remoteArtChanged) {
    art = localArt;
  } else if (remoteArtChanged && !localArtChanged) {
    art = remoteArt;
  } else if (localArtChanged && remoteArtChanged) {
    art = areArtEqual(localArt, remoteArt) ? localArt : localArt;
  } else {
    art = localArt ?? remoteArt ?? baseArt ?? null;
  }

  // 6. Genres
  const baseGenres = baseSnap?.genres ?? [];
  const localGenres = localSnap?.genres ?? [];
  const remoteGenres = remoteSnap?.genres ?? [];
  const localGenresChanged = !areGenresEqual(localGenres, baseGenres);
  const remoteGenresChanged = !areGenresEqual(remoteGenres, baseGenres);
  let genres: string[];
  if (localGenresChanged && !remoteGenresChanged) {
    genres = localGenres;
  } else if (remoteGenresChanged && !localGenresChanged) {
    genres = remoteGenres;
  } else if (localGenresChanged && remoteGenresChanged) {
    genres = areGenresEqual(localGenres, remoteGenres) ? localGenres : localGenres;
  } else {
    genres = localGenres.length > 0 ? localGenres : remoteGenres.length > 0 ? remoteGenres : baseGenres;
  }

  return sanitizeSnapshot(
    {
      id: defaultId,
      title,
      year,
      rating,
      posterUrl,
      art,
      genres,
    },
    defaultId
  );
}

/**
 * Three-way personal storage merge for concurrent cross-tab updates with deletion awareness.
 * Compares base snapshot against local and remote states at field level:
 * - Favorites: preserves local deletion (unfavorite) when remote is stale.
 * - Watchlist/Watched: 3-way field comparison; deterministic Local-wins conflict rule.
 * - Personal ratings: 3-way field comparison; deterministic Local-wins conflict rule.
 * - Comments: merged by unique comment ID with deletion-vs-edit awareness (Local deletion wins; Remote deletion preserves Local edit).
 * - Profile: 3-way merge on displayName and bio independently.
 * - Record pruning: removes movie records where all personal data was removed.
 * - Pure and deterministic: no wall-clock timestamp generation.
 */
export function threeWayMergePersonalStates(
  base: PersonalStorageSchema,
  local: PersonalStorageSchema,
  remote: PersonalStorageSchema | PersonalBackupV1
): PersonalStorageSchema {
  const mergedMovies: Record<string, PersonalRecord> = {};
  const allMovieIds = new Set<string>([
    ...Object.keys(base.movies),
    ...Object.keys(local.movies),
    ...Object.keys(remote.movies),
  ]);

  for (const id of allMovieIds) {
    const baseRecord = base.movies[id];
    const localRecord = local.movies[id];
    const remoteRecord = remote.movies[id];

    // Check record deletion/addition cases relative to Base:
    if (baseRecord) {
      // Movie was in Base:
      if (!localRecord && remoteRecord) {
        // Local deleted the movie/record.
        // Under documented Local-wins conflict rule, Local deletion wins.
        continue;
      }

      if (localRecord && !remoteRecord) {
        // Remote deleted the movie/record (e.g. remote removal or localStorage.clear()).
        if (areRecordsEqual(baseRecord, localRecord)) {
          // Local did not touch this record: untouched base record removed!
          continue;
        }
        // Local modified the movie while Remote deleted it -> preserve Local edit!
        mergedMovies[id] = { ...localRecord };
        continue;
      }

      if (!localRecord && !remoteRecord) {
        // Both sides deleted the record.
        continue;
      }
    } else {
      // Movie was NOT in Base:
      if (localRecord && !remoteRecord) {
        // Local added it.
        mergedMovies[id] = { ...localRecord };
        continue;
      }
      if (!localRecord && remoteRecord) {
        // Remote added it.
        mergedMovies[id] = { ...remoteRecord };
        continue;
      }
      if (!localRecord && !remoteRecord) {
        continue;
      }
    }

    // Both localRecord and remoteRecord exist:
    const bRec = baseRecord;
    const lRec = localRecord!;
    const rRec = remoteRecord!;

    // 1. Favorites 3-way
    const baseFav = bRec ? bRec.isFavorite === true : false;
    const localFav = lRec.isFavorite === true;
    const remoteFav = rRec.isFavorite === true;

    let isFavorite: boolean;
    if (localFav !== baseFav && remoteFav === baseFav) {
      isFavorite = localFav;
    } else if (remoteFav !== baseFav && localFav === baseFav) {
      isFavorite = remoteFav;
    } else if (localFav !== baseFav && remoteFav !== baseFav) {
      isFavorite = localFav; // conflict: local wins
    } else {
      isFavorite = localFav;
    }

    // 2. Watchlist / Watched 3-way (pure field-level comparison)
    const baseStatus =
      bRec && (bRec.listStatus === "watchlist" || bRec.listStatus === "watched")
        ? bRec.listStatus
        : null;
    const localStatus =
      lRec.listStatus === "watchlist" || lRec.listStatus === "watched"
        ? lRec.listStatus
        : null;
    const remoteStatus =
      rRec.listStatus === "watchlist" || rRec.listStatus === "watched"
        ? rRec.listStatus
        : null;

    let listStatus: "watchlist" | "watched" | null;
    if (localStatus !== baseStatus && remoteStatus === baseStatus) {
      listStatus = localStatus;
    } else if (remoteStatus !== baseStatus && localStatus === baseStatus) {
      listStatus = remoteStatus;
    } else if (localStatus !== baseStatus && remoteStatus !== baseStatus) {
      if (localStatus === remoteStatus) {
        listStatus = localStatus;
      } else {
        // Both changed differently: deterministic Local-wins policy
        listStatus = localStatus;
      }
    } else {
      listStatus = localStatus;
    }

    // 3. Personal Rating 3-way (pure field-level comparison)
    const baseRating =
      bRec && typeof bRec.personalRating === "number" && !Number.isNaN(bRec.personalRating)
        ? bRec.personalRating
        : null;
    const localRating =
      typeof lRec.personalRating === "number" && !Number.isNaN(lRec.personalRating)
        ? lRec.personalRating
        : null;
    const remoteRating =
      typeof rRec.personalRating === "number" && !Number.isNaN(rRec.personalRating)
        ? rRec.personalRating
        : null;

    let personalRating: number | null;
    if (localRating !== baseRating && remoteRating === baseRating) {
      personalRating = localRating;
    } else if (remoteRating !== baseRating && localRating === baseRating) {
      personalRating = remoteRating;
    } else if (localRating !== baseRating && remoteRating !== baseRating) {
      if (localRating === remoteRating) {
        personalRating = localRating;
      } else {
        // Both changed differently: deterministic Local-wins policy
        personalRating = localRating;
      }
    } else {
      personalRating = localRating;
    }

    // 4. Comments 3-way with deletion-vs-edit resolution
    const baseComments = bRec?.comments ?? [];
    const localComments = lRec.comments ?? [];
    const remoteComments = rRec.comments ?? [];

    const baseCommentMap = new Map<string, PersonalComment>(baseComments.map((c) => [c.id, c]));
    const localCommentMap = new Map<string, PersonalComment>(localComments.map((c) => [c.id, c]));
    const remoteCommentMap = new Map<string, PersonalComment>(remoteComments.map((c) => [c.id, c]));
    const allCommentIds = new Set<string>([
      ...baseCommentMap.keys(),
      ...localCommentMap.keys(),
      ...remoteCommentMap.keys(),
    ]);

    const mergedCommentMap = new Map<string, PersonalComment>();
    for (const cid of allCommentIds) {
      const inBase = baseCommentMap.has(cid);
      const inLocal = localCommentMap.has(cid);
      const inRemote = remoteCommentMap.has(cid);

      if (inBase) {
        const b = baseCommentMap.get(cid)!;
        const l = inLocal ? localCommentMap.get(cid)! : null;
        const r = inRemote ? remoteCommentMap.get(cid)! : null;

        if (l && r) {
          const localEdited = l.text !== b.text;
          const remoteEdited = r.text !== b.text;
          if (localEdited && !remoteEdited) {
            mergedCommentMap.set(cid, l);
          } else if (remoteEdited && !localEdited) {
            mergedCommentMap.set(cid, r);
          } else if (localEdited && remoteEdited) {
            mergedCommentMap.set(cid, l); // local wins
          } else {
            mergedCommentMap.set(cid, l);
          }
        } else if (l && !r) {
          // Remote deleted the comment!
          const localEdited = l.text !== b.text;
          if (localEdited) {
            // Remote deletes while Local edits: preserve Local edit!
            mergedCommentMap.set(cid, l);
          }
          // If Local was unchanged: accept Remote deletion (do not include)
        } else if (!l && r) {
          // Local deleted the comment!
          // Local deletion wins over Remote edit or Remote unchanged (Local-wins rule)
          // Do not include -> deleted!
        }
      } else {
        // Not in base: added concurrently
        const l = inLocal ? localCommentMap.get(cid)! : null;
        const r = inRemote ? remoteCommentMap.get(cid)! : null;
        if (l && r) {
          // Same-ID concurrent additions with different content: deterministic Local-wins
          mergedCommentMap.set(cid, l);
        } else if (l) {
          mergedCommentMap.set(cid, l);
        } else if (r) {
          mergedCommentMap.set(cid, r);
        }
      }
    }

    const mergedComments = Array.from(mergedCommentMap.values()).sort((a, b) => {
      const timeA = parseTimestampSafe(a.createdAt) ?? 0;
      const timeB = parseTimestampSafe(b.createdAt) ?? 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    // 5. Snapshot: genuine three-way merge
    const mergedSnapshot = threeWayMergeMovieSnapshot(
      bRec?.snapshot,
      lRec.snapshot,
      rRec.snapshot,
      id
    );

    // 6. UpdatedAt: deterministic, pure, no wall-clock fallback
    const localTime = parseTimestampSafe(lRec.updatedAt);
    const remoteTime = parseTimestampSafe(rRec.updatedAt);
    const baseTime = parseTimestampSafe(bRec?.updatedAt);
    const validTimes = [localTime, remoteTime, baseTime].filter(
      (t): t is number => t !== null && Number.isFinite(t)
    );

    let updatedAt: string;
    if (validTimes.length > 0) {
      const maxTime = Math.max(...validTimes);
      updatedAt = new Date(maxTime).toISOString();
    } else {
      updatedAt = "1970-01-01T00:00:00.000Z";
    }

    const candidateRecord: PersonalRecord = {
      id,
      snapshot: mergedSnapshot,
      isFavorite,
      listStatus,
      personalRating,
      comments: mergedComments.length > 0 ? mergedComments : undefined,
      updatedAt,
    };

    if (!isRecordEmpty(candidateRecord)) {
      mergedMovies[id] = candidateRecord;
    }
  }

  // Profile 3-way
  const baseName = base.profile?.displayName ?? "";
  const localName = local.profile?.displayName ?? "";
  const remoteName = remote.profile?.displayName ?? "";

  let mergedDisplayName: string;
  if (localName !== baseName && remoteName === baseName) {
    mergedDisplayName = localName;
  } else if (remoteName !== baseName && localName === baseName) {
    mergedDisplayName = remoteName;
  } else if (localName !== baseName && remoteName !== baseName) {
    mergedDisplayName = localName;
  } else {
    mergedDisplayName = localName;
  }

  const baseBio = base.profile?.bio ?? "";
  const localBio = local.profile?.bio ?? "";
  const remoteBio = remote.profile?.bio ?? "";

  let mergedBio: string;
  if (localBio !== baseBio && remoteBio === baseBio) {
    mergedBio = localBio;
  } else if (remoteBio !== baseBio && localBio === baseBio) {
    mergedBio = remoteBio;
  } else if (localBio !== baseBio && remoteBio !== baseBio) {
    mergedBio = localBio;
  } else {
    mergedBio = localBio;
  }

  let mergedProfile: PersonalProfile | undefined = undefined;
  if (mergedDisplayName || mergedBio) {
    mergedProfile = { displayName: mergedDisplayName, bio: mergedBio };
  } else if (local.profile !== undefined || remote.profile !== undefined) {
    mergedProfile = { displayName: mergedDisplayName, bio: mergedBio };
  }

  return {
    version: CURRENT_STORAGE_VERSION,
    movies: mergedMovies,
    profile: mergedProfile,
  };
}

/**
 * Safely merges two personal storage states.
 * Used for additive backup imports and backwards compatibility.
 */
export function mergePersonalStates(
  local: PersonalStorageSchema,
  remote: PersonalStorageSchema | PersonalBackupV1
): PersonalStorageSchema {
  const mergedMovies: Record<string, PersonalRecord> = { ...local.movies };

  for (const [id, remoteRecord] of Object.entries(remote.movies)) {
    const existing = mergedMovies[id];
    if (!existing) {
      mergedMovies[id] = { ...remoteRecord };
      continue;
    }

    // 1. Favorites union
    const isFavorite = existing.isFavorite || remoteRecord.isFavorite;

    // 2. Watchlist/Watched conflict resolution by validated timestamp
    let listStatus = existing.listStatus;
    if (remoteRecord.listStatus && !existing.listStatus) {
      listStatus = remoteRecord.listStatus;
    } else if (remoteRecord.listStatus && existing.listStatus) {
      if (remoteRecord.listStatus === existing.listStatus) {
        listStatus = existing.listStatus;
      } else {
        const existingTime = parseTimestampSafe(existing.updatedAt);
        const remoteTime = parseTimestampSafe(remoteRecord.updatedAt);

        if (existingTime !== null && remoteTime !== null) {
          if (remoteTime > existingTime) {
            listStatus = remoteRecord.listStatus;
          } else if (existingTime > remoteTime) {
            listStatus = existing.listStatus;
          } else {
            // Deterministic tie rule for exact equal timestamps:
            // "watched" takes precedence over "watchlist" because watched denotes completion
            listStatus =
              remoteRecord.listStatus === "watched" || existing.listStatus === "watched"
                ? "watched"
                : remoteRecord.listStatus;
          }
        } else if (remoteTime !== null) {
          listStatus = remoteRecord.listStatus;
        } else if (existingTime !== null) {
          listStatus = existing.listStatus;
        } else {
          // Both timestamps invalid/missing: deterministic tie rule
          listStatus =
            remoteRecord.listStatus === "watched" || existing.listStatus === "watched"
              ? "watched"
              : remoteRecord.listStatus;
        }
      }
    }

    // 3. Personal rating: remote value takes precedence if defined
    let personalRating = existing.personalRating;
    if (remoteRecord.personalRating !== undefined && remoteRecord.personalRating !== null) {
      personalRating = remoteRecord.personalRating;
    }

    // 4. Comments: merge by unique ID
    const existingComments = Array.isArray(existing.comments) ? existing.comments : [];
    const remoteComments = Array.isArray(remoteRecord.comments) ? remoteRecord.comments : [];
    const commentMap = new Map<string, PersonalComment>();
    for (const c of existingComments) {
      commentMap.set(c.id, c);
    }
    for (const c of remoteComments) {
      commentMap.set(c.id, c);
    }
    const mergedComments = Array.from(commentMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // 5. Snapshot: prefer remote if complete
    const mergedSnapshot = {
      ...existing.snapshot,
      ...remoteRecord.snapshot,
    };

    const existingTime = parseTimestampSafe(existing.updatedAt) ?? 0;
    const remoteTime = parseTimestampSafe(remoteRecord.updatedAt) ?? 0;
    const maxTime = Math.max(existingTime, remoteTime);
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

  // Profile merge: prefer local profile if present and non-empty, otherwise remote
  let profile = local.profile;
  if (!profile || (!profile.displayName && !profile.bio)) {
    if (remote.profile && (remote.profile.displayName || remote.profile.bio)) {
      profile = { ...remote.profile };
    }
  }

  return {
    version: CURRENT_STORAGE_VERSION,
    movies: mergedMovies,
    profile,
  };
}

function onStorageEvent(event: StorageEvent): void {
  // Filter incoming storage events: ignore unrelated keys and temporary probe keys.
  // event.key === null occurs when localStorage.clear() is called.
  if (event.key !== null && event.key !== PERSONAL_STORAGE_KEY) {
    return;
  }

  const storage = getSafeLocalStorage();
  const readResult = safeReadPersonalStorage(storage);

  if (!readResult.success) {
    if (readResult.reason === "inaccessible") {
      // Storage read threw or storage is inaccessible.
      // Preserve existing in-memory cachedSnapshot (session-only data remains intact)
      // and update availability state.
      setPersonalStorageAvailable(false);
    }
    // If reason is "corrupt" or "unsupported_version":
    // The storage API itself is accessible, but the incoming payload is invalid.
    // Preserve existing in-memory cachedSnapshot without overwriting, discarding mutations,
    // or treating corrupt payload as deletion.
    return;
  }

  if (hasSessionMutations && cachedSnapshot !== null) {
    // Local session mutations are pending!
    // Multi-event merge architecture:
    // Base is the latest accepted remote snapshot (or original session base if first remote event).
    // Local is the current merged in-memory snapshot (preserving pending local intent).
    // Remote is the newly received persistent storage data.
    const remoteBaseline = latestRemoteSnapshot ?? sessionBaseSnapshot ?? getInitialPersonalState();
    cachedSnapshot = threeWayMergePersonalStates(
      remoteBaseline,
      cachedSnapshot,
      readResult.data
    );
    // Update latestRemoteSnapshot to the newly received remote state so future remote events
    // do not mistake previously accepted remote data for new local edits.
    latestRemoteSnapshot = readResult.data;
    // Keep hasSessionMutations = true until explicitly persisted by writePersonalStorage
  } else {
    cachedSnapshot = readResult.data;
    hasSessionMutations = false;
    sessionBaseSnapshot = null;
    latestRemoteSnapshot = null;
  }

  if (cachedAvailability) {
    notifySubscribers();
  } else {
    setPersonalStorageAvailable(true);
  }
}

function onCustomEvent(): void {
  if (isWriting) return;
  const storage = getSafeLocalStorage();
  const readResult = safeReadPersonalStorage(storage);

  if (!readResult.success) {
    if (readResult.reason === "inaccessible") {
      setPersonalStorageAvailable(false);
    }
    return;
  }

  if (hasSessionMutations && cachedSnapshot !== null) {
    const remoteBaseline = latestRemoteSnapshot ?? sessionBaseSnapshot ?? getInitialPersonalState();
    cachedSnapshot = threeWayMergePersonalStates(
      remoteBaseline,
      cachedSnapshot,
      readResult.data
    );
    latestRemoteSnapshot = readResult.data;
  } else {
    cachedSnapshot = readResult.data;
    hasSessionMutations = false;
    sessionBaseSnapshot = null;
    latestRemoteSnapshot = null;
  }

  if (cachedAvailability) {
    notifySubscribers();
  } else {
    setPersonalStorageAvailable(true);
  }
}

/**
 * Subscribes to changes in personal storage (same-tab and cross-tab).
 * Filters storage events to prevent feedback loops from probe keys or unrelated entries.
 */
export function subscribePersonalStorage(callback: () => void): () => void {
  subscribers.add(callback);

  if (typeof window !== "undefined" && !windowListenersAttached) {
    window.addEventListener(PERSONAL_UPDATE_EVENT, onCustomEvent);
    window.addEventListener("storage", onStorageEvent);
    windowListenersAttached = true;
    checkPersonalStorageAvailability();
  }

  return () => {
    subscribers.delete(callback);
    if (typeof window !== "undefined" && subscribers.size === 0 && windowListenersAttached) {
      window.removeEventListener(PERSONAL_UPDATE_EVENT, onCustomEvent);
      window.removeEventListener("storage", onStorageEvent);
      windowListenersAttached = false;
    }
  };
}

/**
 * Safely persists personal state to localStorage and dispatches a synchronization event.
 * Guarantees exactly one subscriber notification per write operation.
 * Returns true if persisted to storage; false if storage was unavailable or write was blocked (session-only memory state).
 *
 * Forward-Compatibility & Fail-Closed Protection:
 * Inspects persistent storage before writing.
 * - If reading the existing payload via storage.getItem() fails, the write fails closed: setItem() is never
 *   called, physical availability is marked false, pending session mutations are preserved, and false is returned.
 * - If persistent storage holds a payload with a confirmed schema version newer than CURRENT_STORAGE_VERSION
 *   (e.g. version > 1), the write is blocked to prevent destructive forward-compatibility data loss. The attempted
 *   mutation is preserved in memory as session-only state, hasSessionMutations remains true, and false is returned.
 * - If persistent storage contains malformed/corrupt JSON, writes are intentionally permitted to proceed to heal
 *   and overwrite the damaged data with the valid user state, ensuring in-memory mutations are persisted.
 *
 * Concurrency Limitation:
 * The Web Storage API (localStorage) lacks atomic compare-and-swap (CAS) or conditional-write primitives
 * and does not support cross-context transactions. While this read-before-write check reliably prevents
 * sequential overwrites of newer schema versions, it cannot provide atomic cross-context guarantees if another
 * browsing context (e.g. worker, iframe, or concurrent browser process) writes a newer schema payload concurrently.
 */
export function writePersonalStorage(
  state: PersonalStorageSchema,
  storage: Storage | null = getSafeLocalStorage()
): boolean {
  isWriting = true;
  const previousSnapshot = cachedSnapshot !== null ? cachedSnapshot : readPersonalStorage(storage);
  cachedSnapshot = state;

  try {
    if (!storage) {
      if (sessionBaseSnapshot === null) {
        sessionBaseSnapshot = previousSnapshot;
        latestRemoteSnapshot = previousSnapshot;
      }
      hasSessionMutations = true;
      setPersonalStorageAvailable(false);
      return false;
    }

    try {
      let existingRaw: string | null = null;
      try {
        existingRaw = storage.getItem(PERSONAL_STORAGE_KEY);
      } catch {
        // Failed getItem() must block writes: storage is inaccessible.
        // Fail-closed to prevent bypassing the forward-compatibility guard when getItem() throws but setItem() might succeed.
        if (sessionBaseSnapshot === null) {
          sessionBaseSnapshot = previousSnapshot;
          latestRemoteSnapshot = previousSnapshot;
        }
        hasSessionMutations = true;
        setPersonalStorageAvailable(false);
        return false;
      }

      if (existingRaw === null) {
        cachedUnsupportedVersion = false;
      } else {
        try {
          const parsed = JSON.parse(existingRaw);
          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed) &&
            typeof parsed.version === "number"
          ) {
            if (parsed.version > CURRENT_STORAGE_VERSION) {
              cachedUnsupportedVersion = true;
              if (sessionBaseSnapshot === null) {
                sessionBaseSnapshot = previousSnapshot;
                latestRemoteSnapshot = previousSnapshot;
              }
              hasSessionMutations = true;
              // Physical storage is accessible; do NOT call setPersonalStorageAvailable(false).
              // Return false to indicate state was not persisted to disk (session-only memory state).
              return false;
            } else {
              cachedUnsupportedVersion = false;
            }
          }
        } catch {
          // Intentional healing/overwrite policy:
          // Malformed JSON is not a confirmed newer schema. A valid user mutation is permitted
          // to overwrite and repair the corrupt payload on disk, persisting the user's state
          // and restoring storage integrity without discarding in-memory data.
          // Retains the previous compatibility observation because corrupt JSON does not confirm a new schema.
        }
      }

      const serialized = JSON.stringify(state);
      storage.setItem(PERSONAL_STORAGE_KEY, serialized);
      hasSessionMutations = false;
      sessionBaseSnapshot = null;
      latestRemoteSnapshot = null;
      cachedUnsupportedVersion = false;
      setPersonalStorageAvailable(true);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(PERSONAL_UPDATE_EVENT, { detail: state })
        );
      }
      return true;
    } catch {
      // QuotaExceededError or security restriction (storage unavailable)
      if (sessionBaseSnapshot === null) {
        sessionBaseSnapshot = previousSnapshot;
        latestRemoteSnapshot = previousSnapshot;
      }
      hasSessionMutations = true;
      setPersonalStorageAvailable(false);
      return false;
    }
  } finally {
    isWriting = false;
    notifySubscribers();
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
  const merged = mergePersonalStates(currentState, backup);
  if (backup.profile && (backup.profile.displayName || backup.profile.bio)) {
    merged.profile = { ...backup.profile };
  }
  return merged;
}

export function resetPersonalDataInStore(): PersonalStorageSchema {
  return {
    version: CURRENT_STORAGE_VERSION,
    movies: {},
    profile: undefined,
  };
}
