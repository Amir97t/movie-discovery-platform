import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { PersonalProvider, usePersonal } from "./personal-context";
import { PERSONAL_STORAGE_KEY, resetPersonalStorageCache } from "./personal-storage";
import type { MovieSnapshot } from "./personal-types";

const mockSnapshot: MovieSnapshot = {
  id: "movie-ctx-1",
  title: "Context Movie",
  year: 2025,
  rating: 8.8,
  posterUrl: "/sample.svg",
  art: ["#000", "#fff"],
  genres: ["scifi"],
};

describe("personal-context", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PersonalProvider>{children}</PersonalProvider>
  );

  it("provides initial state and toggle operations", () => {
    const { result } = renderHook(() => usePersonal(), { wrapper });

    expect(result.current.isReady).toBe(true);
    expect(result.current.isStorageAvailable).toBe(true);
    expect(result.current.isFavorite("movie-ctx-1")).toBe(false);
    expect(result.current.isWatchlist("movie-ctx-1")).toBe(false);
    expect(result.current.isWatched("movie-ctx-1")).toBe(false);

    // Toggle favorite
    act(() => {
      const persisted = result.current.toggleFavorite("movie-ctx-1", mockSnapshot);
      expect(persisted).toBe(true);
    });

    expect(result.current.isFavorite("movie-ctx-1")).toBe(true);
    expect(result.current.getFavorites()).toHaveLength(1);
    expect(result.current.getFavorites()[0]?.snapshot.title).toBe("Context Movie");

    // Persisted to localStorage
    const raw = window.localStorage.getItem(PERSONAL_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain("Context Movie");
  });

  it("handles mutual exclusivity between Watchlist and Watched", () => {
    const { result } = renderHook(() => usePersonal(), { wrapper });

    // Add to Watchlist
    act(() => {
      result.current.toggleWatchlist("movie-ctx-1", mockSnapshot);
    });
    expect(result.current.isWatchlist("movie-ctx-1")).toBe(true);
    expect(result.current.isWatched("movie-ctx-1")).toBe(false);
    expect(result.current.getWatchlist()).toHaveLength(1);
    expect(result.current.getWatched()).toHaveLength(0);

    // Mark as Watched - automatically removes from Watchlist
    act(() => {
      result.current.toggleWatched("movie-ctx-1", mockSnapshot);
    });
    expect(result.current.isWatchlist("movie-ctx-1")).toBe(false);
    expect(result.current.isWatched("movie-ctx-1")).toBe(true);
    expect(result.current.getWatchlist()).toHaveLength(0);
    expect(result.current.getWatched()).toHaveLength(1);

    // Add back to Watchlist - automatically removes from Watched
    act(() => {
      result.current.toggleWatchlist("movie-ctx-1", mockSnapshot);
    });
    expect(result.current.isWatchlist("movie-ctx-1")).toBe(true);
    expect(result.current.isWatched("movie-ctx-1")).toBe(false);
  });

  it("identifies session-only state when storage writes fail", () => {
    // Simulate setItem failure (e.g., QuotaExceededError)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const { result } = renderHook(() => usePersonal(), { wrapper });

    act(() => {
      const persisted = result.current.toggleFavorite("movie-ctx-1", mockSnapshot);
      expect(persisted).toBe(false);
    });

    // In-memory toggle worked for the session, but isStorageAvailable is false
    expect(result.current.isFavorite("movie-ctx-1")).toBe(true);
    expect(result.current.isStorageAvailable).toBe(false);
  });

  it("handles personal rating operations", () => {
    const { result } = renderHook(() => usePersonal(), { wrapper });

    expect(result.current.getPersonalRating("movie-ctx-1")).toBeNull();

    // Set rating
    act(() => {
      const persisted = result.current.setPersonalRating("movie-ctx-1", mockSnapshot, 9.5);
      expect(persisted).toBe(true);
    });
    expect(result.current.getPersonalRating("movie-ctx-1")).toBe(9.5);

    // Set rating to 0
    act(() => {
      result.current.setPersonalRating("movie-ctx-1", mockSnapshot, 0);
    });
    expect(result.current.getPersonalRating("movie-ctx-1")).toBe(0);

    // Clear rating
    act(() => {
      result.current.clearPersonalRating("movie-ctx-1");
    });
    expect(result.current.getPersonalRating("movie-ctx-1")).toBeNull();
  });

  it("handles local comments operations", () => {
    const { result } = renderHook(() => usePersonal(), { wrapper });

    expect(result.current.getComments("movie-ctx-1")).toEqual([]);

    // Add comment
    act(() => {
      const comment = result.current.addComment("movie-ctx-1", mockSnapshot, "Great cinematography!");
      expect(comment).toBeTruthy();
    });

    const comments = result.current.getComments("movie-ctx-1");
    expect(comments).toHaveLength(1);
    expect(comments[0]?.text).toBe("Great cinematography!");
    expect(comments[0]?.id).toBeDefined();

    // Delete comment
    const commentId = comments[0]!.id;
    act(() => {
      result.current.deleteComment("movie-ctx-1", commentId);
    });
    expect(result.current.getComments("movie-ctx-1")).toHaveLength(0);
  });

  it("handles profile updates and exposes reactive statistics", () => {
    const { result } = renderHook(() => usePersonal(), { wrapper });

    expect(result.current.profile).toBeUndefined();
    expect(result.current.statistics.favoritesCount).toBe(0);

    // Update profile
    act(() => {
      const persisted = result.current.updateProfile({
        displayName: "Film Critic",
        bio: "Writing reviews daily.",
      });
      expect(persisted).toBe(true);
    });

    expect(result.current.profile?.displayName).toBe("Film Critic");
    expect(result.current.profile?.bio).toBe("Writing reviews daily.");

    // Toggle favorite and add rating to verify statistics update reactively
    act(() => {
      result.current.toggleFavorite("movie-ctx-1", mockSnapshot);
      result.current.setPersonalRating("movie-ctx-1", mockSnapshot, 9.0);
    });

    expect(result.current.statistics.favoritesCount).toBe(1);
    expect(result.current.statistics.ratedCount).toBe(1);
    expect(result.current.statistics.averageRating).toBe(9.0);
  });

  it("handles backup export, import, and atomic reset", () => {
    const { result } = renderHook(() => usePersonal(), { wrapper });

    act(() => {
      result.current.toggleFavorite("movie-ctx-1", mockSnapshot);
      result.current.updateProfile({ displayName: "Amir", bio: "Bio" });
    });

    // Export backup
    const backup = result.current.exportBackup();
    expect(backup.format).toBe("movie-discovery-platform-backup");
    expect(backup.profile?.displayName).toBe("Amir");
    expect(backup.movies["movie-ctx-1"]).toBeDefined();

    // Reset data
    act(() => {
      const resetOk = result.current.resetAllData();
      expect(resetOk).toBe(true);
    });

    expect(result.current.profile).toBeUndefined();
    expect(result.current.isFavorite("movie-ctx-1")).toBe(false);
    expect(result.current.statistics.favoritesCount).toBe(0);

    // Import backup
    act(() => {
      const importOk = result.current.importBackup(backup);
      expect(importOk).toBe(true);
    });

    expect(result.current.profile?.displayName).toBe("Amir");
    expect(result.current.isFavorite("movie-ctx-1")).toBe(true);
    expect(result.current.statistics.favoritesCount).toBe(1);
  });
});
