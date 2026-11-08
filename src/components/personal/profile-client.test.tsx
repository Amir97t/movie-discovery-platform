import { render, screen, fireEvent } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { ProfileClient } from "./profile-client";
import { PersonalProvider } from "@/features/personal/personal-context";
import {
  resetPersonalStorageCache,
  setPersonalRatingInStore,
  toggleFavoriteInStore,
  toggleWatchedInStore,
  writePersonalStorage,
} from "@/features/personal/personal-storage";
import type { MovieSnapshot } from "@/features/personal/personal-types";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string, params?: { phrase?: string }) => {
    if (params?.phrase) return `${namespace}.${key}: ${params.phrase}`;
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

const mockMovie: MovieSnapshot = {
  id: "profile-movie-1",
  title: "Profile Movie",
  year: 2024,
  rating: 8.0,
  posterUrl: null,
  art: null,
  genres: ["sci-fi", "drama"],
};

describe("ProfileClient", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<PersonalProvider>{ui}</PersonalProvider>);
  };

  it("renders profile header, default state, and zeroed statistics", () => {
    renderWithProvider(<ProfileClient />);

    expect(screen.getByTestId("profile-container")).toBeInTheDocument();
    expect(screen.getByTestId("profile-display-name")).toHaveTextContent("profile.defaultName");
    expect(screen.getByTestId("profile-bio")).toHaveTextContent("profile.defaultBio");

    // Stat counts
    expect(screen.getByTestId("stat-count-favorites")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-count-watchlist")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-count-watched")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-count-rated")).toHaveTextContent("0");
    expect(screen.getByTestId("stat-value-avg-rating")).toHaveTextContent("—");
    expect(screen.getByTestId("stat-count-comments")).toHaveTextContent("0");

    expect(screen.getByTestId("no-genres-text")).toBeInTheDocument();
  });

  it("allows editing display name and bio with save feedback", () => {
    renderWithProvider(<ProfileClient />);

    const editBtn = screen.getByTestId("edit-profile-btn");
    fireEvent.click(editBtn);

    const nameInput = screen.getByTestId("display-name-input");
    const bioInput = screen.getByTestId("bio-input");
    const saveBtn = screen.getByTestId("save-profile-btn");

    fireEvent.change(nameInput, { target: { value: "Film Buff" } });
    fireEvent.change(bioInput, { target: { value: "Watching 3 movies every weekend." } });
    fireEvent.click(saveBtn);

    expect(screen.getByTestId("profile-display-name")).toHaveTextContent("Film Buff");
    expect(screen.getByTestId("profile-bio")).toHaveTextContent("Watching 3 movies every weekend.");
    expect(screen.getByTestId("profile-status-message")).toHaveTextContent("profile.profileSaved");
  });

  it("displays live calculated statistics and genre tags", () => {
    let state = { version: 1 as const, movies: {} };
    state = toggleFavoriteInStore(state, "profile-movie-1", mockMovie);
    state = toggleWatchedInStore(state, "profile-movie-1", mockMovie);
    state = setPersonalRatingInStore(state, "profile-movie-1", mockMovie, 9.0);
    writePersonalStorage(state);

    renderWithProvider(<ProfileClient />);

    expect(screen.getByTestId("stat-count-favorites")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-count-watched")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-count-rated")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-value-avg-rating")).toHaveTextContent("9.0");

    expect(screen.getByTestId("genre-pill-sci-fi")).toBeInTheDocument();
    expect(screen.getByTestId("genre-pill-drama")).toBeInTheDocument();
  });

  it("handles backup export using blob and download link", () => {
    vi.useFakeTimers();
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    renderWithProvider(<ProfileClient />);

    const exportBtn = screen.getByTestId("export-backup-btn");
    fireEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURLMock).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("protects data reset with explicit 'RESET' phrase confirmation", () => {
    let state = { version: 1 as const, movies: {} };
    state = toggleFavoriteInStore(state, "profile-movie-1", mockMovie);
    writePersonalStorage(state);

    renderWithProvider(<ProfileClient />);

    expect(screen.getByTestId("stat-count-favorites")).toHaveTextContent("1");

    // Open Reset modal
    const resetBtn = screen.getByTestId("reset-data-btn");
    fireEvent.click(resetBtn);

    const modal = screen.getByTestId("reset-confirmation-modal");
    expect(modal).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-reset-btn");
    const input = screen.getByTestId("reset-confirm-input");

    // Disabled until RESET is typed
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: "WRONG" } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: "RESET" } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    // Modal closes and statistics reset
    expect(screen.queryByTestId("reset-confirmation-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("stat-count-favorites")).toHaveTextContent("0");
    expect(screen.getByTestId("profile-status-message")).toBeInTheDocument();
  });
});
