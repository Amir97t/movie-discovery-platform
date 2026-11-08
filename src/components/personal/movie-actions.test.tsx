import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { CardPersonalActions, DetailPersonalActions } from "./movie-actions";
import { PersonalProvider } from "@/features/personal/personal-context";
import { resetPersonalStorageCache } from "@/features/personal/personal-storage";
import type { MovieSnapshot } from "@/features/personal/personal-types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: { title?: string }) => {
    if (params?.title) return `${key} (${params.title})`;
    return key;
  },
}));

const mockSnapshot: MovieSnapshot = {
  id: "fixture-actions-1",
  title: "Actions Test",
  year: 2024,
  rating: 8.0,
  posterUrl: "/test.jpg",
  art: null,
  genres: ["drama"],
};

describe("Personal Movie Actions", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<PersonalProvider>{ui}</PersonalProvider>);
  };

  describe("CardPersonalActions", () => {
    it("renders compact action buttons with accessible labels", () => {
      renderWithProvider(
        <CardPersonalActions id="fixture-actions-1" snapshot={mockSnapshot} />
      );

      const fav = screen.getByTestId("card-favorite-btn");
      const watchlist = screen.getByTestId("card-watchlist-btn");
      const watched = screen.getByTestId("card-watched-btn");

      expect(fav).toHaveAttribute("aria-pressed", "false");
      expect(watchlist).toHaveAttribute("aria-pressed", "false");
      expect(watched).toHaveAttribute("aria-pressed", "false");
    });

    it("stops propagation when clicked so card navigation does not trigger", () => {
      const parentClickHandler = vi.fn();

      renderWithProvider(
        <div onClick={parentClickHandler}>
          <CardPersonalActions id="fixture-actions-1" snapshot={mockSnapshot} />
        </div>
      );

      const fav = screen.getByTestId("card-favorite-btn");
      fireEvent.click(fav);

      expect(fav).toHaveAttribute("aria-pressed", "true");
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe("DetailPersonalActions", () => {
    it("renders prominent action pill buttons and updates state on click", () => {
      renderWithProvider(
        <DetailPersonalActions id="fixture-actions-1" snapshot={mockSnapshot} />
      );

      const fav = screen.getByTestId("detail-favorite-btn");
      const watchlist = screen.getByTestId("detail-watchlist-btn");
      const watched = screen.getByTestId("detail-watched-btn");

      expect(fav).toHaveAttribute("aria-pressed", "false");
      expect(watchlist).toHaveAttribute("aria-pressed", "false");
      expect(watched).toHaveAttribute("aria-pressed", "false");

      // Click Favorite
      fireEvent.click(fav);
      expect(fav).toHaveAttribute("aria-pressed", "true");

      // Click Watchlist
      fireEvent.click(watchlist);
      expect(watchlist).toHaveAttribute("aria-pressed", "true");

      // Click Watched - should clear Watchlist
      fireEvent.click(watched);
      expect(watched).toHaveAttribute("aria-pressed", "true");
      expect(watchlist).toHaveAttribute("aria-pressed", "false");
    });

    it("displays storage unavailable notice when storage writes fail", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      renderWithProvider(
        <DetailPersonalActions id="fixture-actions-1" snapshot={mockSnapshot} />
      );

      const fav = screen.getByTestId("detail-favorite-btn");
      fireEvent.click(fav);

      expect(screen.getByTestId("storage-unavailable-notice")).toBeInTheDocument();
      expect(screen.getByText("storageUnavailableNotice")).toBeInTheDocument();
    });
  });
});
