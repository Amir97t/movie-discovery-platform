import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { PersonalRatingSection } from "./personal-rating";
import { PersonalProvider } from "@/features/personal/personal-context";
import { resetPersonalStorageCache } from "@/features/personal/personal-storage";
import type { MovieSnapshot } from "@/features/personal/personal-types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: { value?: number | string }) => {
    if (params?.value !== undefined) return `${key}: ${params.value}`;
    return key;
  },
}));

const mockSnapshot: MovieSnapshot = {
  id: "rating-test-movie",
  title: "Rating Movie",
  year: 2025,
  rating: 8.5,
  posterUrl: "/test.jpg",
  art: null,
  genres: ["sci-fi"],
};

describe("PersonalRatingSection", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<PersonalProvider>{ui}</PersonalProvider>);
  };

  it("renders with initial unrated state", () => {
    renderWithProvider(
      <PersonalRatingSection id="rating-test-movie" snapshot={mockSnapshot} />
    );

    expect(screen.getByTestId("personal-rating-section")).toBeInTheDocument();
    expect(screen.getByText("notRated")).toBeInTheDocument();
    expect(screen.queryByTestId("clear-rating-btn")).not.toBeInTheDocument();
  });

  it("sets rating by clicking a star button and allows clearing", () => {
    renderWithProvider(
      <PersonalRatingSection id="rating-test-movie" snapshot={mockSnapshot} />
    );

    const star8 = screen.getByTestId("star-rating-btn-8");
    fireEvent.click(star8);

    expect(screen.getByText("ratedValue: 8.0")).toBeInTheDocument();

    const clearBtn = screen.getByTestId("clear-rating-btn");
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(screen.getByText("notRated")).toBeInTheDocument();
    expect(screen.queryByTestId("clear-rating-btn")).not.toBeInTheDocument();
  });

  it("supports fractional rating via range slider input", () => {
    renderWithProvider(
      <PersonalRatingSection id="rating-test-movie" snapshot={mockSnapshot} />
    );

    const rangeInput = screen.getByRole("slider");

    fireEvent.change(rangeInput, { target: { value: "7.5" } });

    expect(screen.getByText("ratedValue: 7.5")).toBeInTheDocument();
    expect(rangeInput).toHaveValue("7.5");
  });

  it("supports keyboard stepper navigation", () => {
    renderWithProvider(
      <PersonalRatingSection id="rating-test-movie" snapshot={mockSnapshot} />
    );

    const rangeInput = screen.getByRole("slider");

    // Press End -> 10
    fireEvent.keyDown(rangeInput, { key: "End" });
    expect(screen.getByText("ratedValue: 10.0")).toBeInTheDocument();

    // ArrowLeft -> 9.5
    fireEvent.keyDown(rangeInput, { key: "ArrowLeft" });
    expect(screen.getByText("ratedValue: 9.5")).toBeInTheDocument();

    // Home -> 0
    fireEvent.keyDown(rangeInput, { key: "Home" });
    expect(screen.getByText("ratedValue: 0.0")).toBeInTheDocument();

    // ArrowRight -> 0.5
    fireEvent.keyDown(rangeInput, { key: "ArrowRight" });
    expect(screen.getByText("ratedValue: 0.5")).toBeInTheDocument();

    // Delete -> clears
    fireEvent.keyDown(rangeInput, { key: "Delete" });
    expect(screen.getByText("notRated")).toBeInTheDocument();
  });

  it("displays storage unavailable notice if persistence fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    renderWithProvider(
      <PersonalRatingSection id="rating-test-movie" snapshot={mockSnapshot} />
    );

    const star7 = screen.getByTestId("star-rating-btn-7");
    fireEvent.click(star7);

    expect(screen.getByTestId("storage-unavailable-notice")).toBeInTheDocument();
  });
});
