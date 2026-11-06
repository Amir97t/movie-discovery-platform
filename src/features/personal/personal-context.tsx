"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  MovieSnapshot,
  PersonalBackupV1,
  PersonalComment,
  PersonalProfile,
  PersonalRecord,
  PersonalStatistics,
  PersonalStorageSchema,
} from "./personal-types";
import {
  addCommentInStore,
  calculatePersonalStatistics,
  clearPersonalRatingInStore,
  createPersonalBackup,
  deleteCommentInStore,
  getInitialPersonalState,
  getPersonalStorageSnapshot,
  isPersonalStorageAvailable,
  mergeImportedDataInStore,
  resetPersonalDataInStore,
  setPersonalRatingInStore,
  subscribePersonalStorage,
  toggleFavoriteInStore,
  toggleWatchedInStore,
  toggleWatchlistInStore,
  updateProfileInStore,
  writePersonalStorage,
} from "./personal-storage";

export interface PersonalContextValue {
  isReady: boolean;
  isStorageAvailable: boolean;
  state: PersonalStorageSchema;
  profile: PersonalProfile | undefined;
  statistics: PersonalStatistics;
  isFavorite: (id: string) => boolean;
  isWatchlist: (id: string) => boolean;
  isWatched: (id: string) => boolean;
  toggleFavorite: (id: string, snapshot: MovieSnapshot) => boolean;
  toggleWatchlist: (id: string, snapshot: MovieSnapshot) => boolean;
  toggleWatched: (id: string, snapshot: MovieSnapshot) => boolean;
  getFavorites: () => PersonalRecord[];
  getWatchlist: () => PersonalRecord[];
  getWatched: () => PersonalRecord[];
  getPersonalRating: (id: string) => number | null;
  setPersonalRating: (id: string, snapshot: MovieSnapshot, rating: number) => boolean;
  clearPersonalRating: (id: string) => boolean;
  getComments: (id: string) => PersonalComment[];
  addComment: (id: string, snapshot: MovieSnapshot, text: string) => PersonalComment | null;
  deleteComment: (movieId: string, commentId: string) => boolean;
  updateProfile: (profile: { displayName: string; bio: string }) => boolean;
  exportBackup: () => PersonalBackupV1;
  importBackup: (backup: PersonalBackupV1) => boolean;
  resetAllData: () => boolean;
}

const PersonalContext = createContext<PersonalContextValue | null>(null);

export function PersonalProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    subscribePersonalStorage,
    getPersonalStorageSnapshot,
    getInitialPersonalState
  );

  const isStorageAvailable = useSyncExternalStore(
    subscribePersonalStorage,
    isPersonalStorageAvailable,
    () => true
  );

  const toggleFavorite = useCallback(
    (id: string, snapshot: MovieSnapshot): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = toggleFavoriteInStore(current, id, snapshot);
      return writePersonalStorage(next);
    },
    []
  );

  const toggleWatchlist = useCallback(
    (id: string, snapshot: MovieSnapshot): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = toggleWatchlistInStore(current, id, snapshot);
      return writePersonalStorage(next);
    },
    []
  );

  const toggleWatched = useCallback(
    (id: string, snapshot: MovieSnapshot): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = toggleWatchedInStore(current, id, snapshot);
      return writePersonalStorage(next);
    },
    []
  );

  const isFavorite = useCallback(
    (id: string) => Boolean(state.movies[id]?.isFavorite),
    [state.movies]
  );

  const isWatchlist = useCallback(
    (id: string) => state.movies[id]?.listStatus === "watchlist",
    [state.movies]
  );

  const isWatched = useCallback(
    (id: string) => state.movies[id]?.listStatus === "watched",
    [state.movies]
  );

  const getFavorites = useCallback(() => {
    return Object.values(state.movies).filter((m) => m.isFavorite);
  }, [state.movies]);

  const getWatchlist = useCallback(() => {
    return Object.values(state.movies).filter((m) => m.listStatus === "watchlist");
  }, [state.movies]);

  const getWatched = useCallback(() => {
    return Object.values(state.movies).filter((m) => m.listStatus === "watched");
  }, [state.movies]);

  const getPersonalRating = useCallback(
    (id: string): number | null => {
      const rating = state.movies[id]?.personalRating;
      return typeof rating === "number" && !Number.isNaN(rating) ? rating : null;
    },
    [state.movies]
  );

  const setPersonalRating = useCallback(
    (id: string, snapshot: MovieSnapshot, rating: number): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = setPersonalRatingInStore(current, id, snapshot, rating);
      return writePersonalStorage(next);
    },
    []
  );

  const clearPersonalRating = useCallback(
    (id: string): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = clearPersonalRatingInStore(current, id);
      return writePersonalStorage(next);
    },
    []
  );

  const getComments = useCallback(
    (id: string): PersonalComment[] => {
      const comments = state.movies[id]?.comments;
      return Array.isArray(comments) ? comments : [];
    },
    [state.movies]
  );

  const addComment = useCallback(
    (id: string, snapshot: MovieSnapshot, text: string): PersonalComment | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      const commentId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const comment: PersonalComment = {
        id: commentId,
        text: trimmed,
        createdAt: new Date().toISOString(),
      };

      const current = getPersonalStorageSnapshot();
      const next = addCommentInStore(current, id, snapshot, comment);
      writePersonalStorage(next);
      return comment;
    },
    []
  );

  const deleteComment = useCallback(
    (movieId: string, commentId: string): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = deleteCommentInStore(current, movieId, commentId);
      return writePersonalStorage(next);
    },
    []
  );

  const updateProfile = useCallback(
    (profile: { displayName: string; bio: string }): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = updateProfileInStore(current, profile);
      return writePersonalStorage(next);
    },
    []
  );

  const exportBackup = useCallback((): PersonalBackupV1 => {
    const current = getPersonalStorageSnapshot();
    return createPersonalBackup(current);
  }, []);

  const importBackup = useCallback(
    (backup: PersonalBackupV1): boolean => {
      const current = getPersonalStorageSnapshot();
      const next = mergeImportedDataInStore(current, backup);
      return writePersonalStorage(next);
    },
    []
  );

  const resetAllData = useCallback((): boolean => {
    const next = resetPersonalDataInStore();
    return writePersonalStorage(next);
  }, []);

  const statistics = useMemo(
    () => calculatePersonalStatistics(state),
    [state]
  );

  const value = useMemo<PersonalContextValue>(
    () => ({
      isReady: true,
      isStorageAvailable,
      state,
      profile: state.profile,
      statistics,
      isFavorite,
      isWatchlist,
      isWatched,
      toggleFavorite,
      toggleWatchlist,
      toggleWatched,
      getFavorites,
      getWatchlist,
      getWatched,
      getPersonalRating,
      setPersonalRating,
      clearPersonalRating,
      getComments,
      addComment,
      deleteComment,
      updateProfile,
      exportBackup,
      importBackup,
      resetAllData,
    }),
    [
      isStorageAvailable,
      state,
      statistics,
      isFavorite,
      isWatchlist,
      isWatched,
      toggleFavorite,
      toggleWatchlist,
      toggleWatched,
      getFavorites,
      getWatchlist,
      getWatched,
      getPersonalRating,
      setPersonalRating,
      clearPersonalRating,
      getComments,
      addComment,
      deleteComment,
      updateProfile,
      exportBackup,
      importBackup,
      resetAllData,
    ]
  );

  return (
    <PersonalContext.Provider value={value}>{children}</PersonalContext.Provider>
  );
}

export function usePersonal() {
  const ctx = useContext(PersonalContext);
  if (!ctx) {
    throw new Error("usePersonal must be used within a PersonalProvider");
  }
  return ctx;
}
