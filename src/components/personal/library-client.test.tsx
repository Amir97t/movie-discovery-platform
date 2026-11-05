import { render, screen, fireEvent } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { LibraryClient } from "./library-client";
import { PersonalProvider } from "@/features/personal/personal-context";
import {
  resetPersonalStorageCache,
  toggleFavoriteInStore,
  toggleWatchlistInStore,
  writePersonalStorage,
} from "@/features/personal/personal-storage";
import type { MovieSnapshot } from "@/features/personal/personal-types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, params?: { count?: number; value?: string }) => {
    if (params?.count !== undefined) return `${namespace}.${key}: ${params.count}`;
    if (params?.value !== undefined) return `${namespace}.${key}: ${params.value}`;
    return `${namespace}.${key}`;
  },
}));

// Mock Link
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockMovie1: MovieSnapshot = {
  id: "lib-movie-1",
  title: "Solaris Dream",
  year: 2024,
  rating: 8.5,
  posterUrl: "/posters/solaris.jpg",
  art: null,
  genres: ["sci-fi", "mystery"],
};

const mockMovie2: MovieSnapshot = {
  id: "lib-movie-2",
  title: "A Midnight Tale",
  year: 2021,
  rating: 7.2,
  posterUrl: null,
  art: ["#111", "#444"],
  genres: ["drama"],
};

describe("LibraryClient", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<PersonalProvider>{ui}</PersonalProvider>);
  };

  it("renders empty state with discover and search links when collections are empty", () => {
    renderWithProvider(<LibraryClient />);

    expect(screen.getByTestId("library-container")).toBeInTheDocument();
    expect(screen.getByTestId("tab-count-favorites")).toHaveTextContent("0");
    expect(screen.getByTestId("tab-count-watchlist")).toHaveTextContent("0");
    expect(screen.getByTestId("tab-count-watched")).toHaveTextContent("0");

    expect(screen.getByText("library.emptyFavoritesTitle")).toBeInTheDocument();
    expect(screen.getByTestId("empty-discover-link")).toHaveAttribute("href", "/discover");
    expect(screen.getByTestId("empty-search-link")).toHaveAttribute("href", "/search");
  });

  it("displays saved favorites in the grid without making network requests", () => {
    let state = { version: 1 as const, movies: {} };
    state = toggleFavoriteInStore(state, "lib-movie-1", mockMovie1);
    writePersonalStorage(state);

    renderWithProvider(<LibraryClient />);

    expect(screen.getByTestId("tab-count-favorites")).toHaveTextContent("1");
    expect(screen.getByText("Solaris Dream")).toBeInTheDocument();
    expect(screen.getByTestId("library-count-text")).toBeInTheDocument();
  });

  it("switches tabs and displays items specific to each collection", () => {
    let state = { version: 1 as const, movies: {} };
    state = toggleFavoriteInStore(state, "lib-movie-1", mockMovie1);
    state = toggleWatchlistInStore(state, "lib-movie-2", mockMovie2);
    writePersonalStorage(state);

    renderWithProvider(<LibraryClient />);

    // Initially in Favorites
    expect(screen.getByText("Solaris Dream")).toBeInTheDocument();
    expect(screen.queryByText("A Midnight Tale")).not.toBeInTheDocument();

    // Click Watchlist Tab
    const watchlistTab = screen.getByTestId("library-tab-watchlist");
    fireEvent.click(watchlistTab);

    expect(screen.getByText("A Midnight Tale")).toBeInTheDocument();
    expect(screen.queryByText("Solaris Dream")).not.toBeInTheDocument();

    // Click Watched Tab -> Empty state
    const watchedTab = screen.getByTestId("library-tab-watched");
    fireEvent.click(watchedTab);

    expect(screen.getByText("library.emptyWatchedTitle")).toBeInTheDocument();
  });

  it("sorts collection items via sort select dropdown", () => {
    let state = { version: 1 as const, movies: {} };
    state = toggleFavoriteInStore(state, "lib-movie-1", mockMovie1);
    state = toggleFavoriteInStore(state, "lib-movie-2", mockMovie2);
    writePersonalStorage(state);

    renderWithProvider(<LibraryClient />);

    const sortSelect = screen.getByTestId("library-sort-select");
    expect(sortSelect).toHaveValue("recently-updated");

    // Change sort to title-asc
    fireEvent.change(sortSelect, { target: { value: "title-asc" } });
    expect(sortSelect).toHaveValue("title-asc");

    // Both cards rendered
    expect(screen.getByText("Solaris Dream")).toBeInTheDocument();
    expect(screen.getByText("A Midnight Tale")).toBeInTheDocument();
  });
});
