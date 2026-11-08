import * as React from "react";
import { vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href?: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: { title?: string }) => {
    if (params?.title) return `${key} ${params.title}`;
    return key;
  },
}));

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { MovieCard } from "./movie-card";
import { PersonalProvider } from "@/features/personal/personal-context";
import { resetPersonalStorageCache } from "@/features/personal/personal-storage";

const base = {
  title: "Salt Line",
  metaText: "Drama · 2022 · 131 min",
  ratingLabel: "Rating 8.1 out of 10",
  notRatedLabel: "Not rated",
  art: ["#2f2a28", "#a89b8c"] as const,
};

describe("MovieCard", () => {
  beforeEach(() => {
    resetPersonalStorageCache();
    window.localStorage.clear();
  });

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(<PersonalProvider>{ui}</PersonalProvider>);
  };

  it("shows title, meta and an accessible rating", () => {
    renderWithProvider(<MovieCard {...base} ratingText="8.1" />);
    expect(screen.getByRole("heading", { level: 3, name: "Salt Line" })).toBeInTheDocument();
    expect(screen.getByText("Drama · 2022 · 131 min")).toBeInTheDocument();
    expect(screen.getByText("Rating 8.1 out of 10")).toBeInTheDocument();
  });

  it("shows a not-rated label instead of a number when rating is missing", () => {
    renderWithProvider(<MovieCard {...base} ratingText={null} ratingLabel="" />);
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });

  it("keeps the full long title in the DOM (clamping is visual only)", () => {
    const long = "Long Take, Longer Night: The Complete Untold Story of a Single Evening on Platform Nine";
    renderWithProvider(<MovieCard {...base} title={long} ratingText="6.5" />);
    expect(screen.getByRole("heading", { name: long })).toBeInTheDocument();
  });

  it("renders without artwork data", () => {
    renderWithProvider(<MovieCard {...base} art={null} metaText="" ratingText={null} ratingLabel="" />);
    expect(screen.getByRole("heading", { name: "Salt Line" })).toBeInTheDocument();
  });

  it("renders links for poster and title when href is provided without nesting buttons in links", () => {
    renderWithProvider(<MovieCard {...base} id="salt-line" ratingText="8.1" href="/movies/salt-line" />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(1);
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/movies/salt-line");
      // Assert no button is inside link
      expect(link.querySelector("button")).toBeNull();
    });
  });

  it("renders personal action buttons when id is provided and toggles state", () => {
    renderWithProvider(<MovieCard {...base} id="salt-line" ratingText="8.1" href="/movies/salt-line" />);

    const favBtn = screen.getByTestId("card-favorite-btn");
    const watchBtn = screen.getByTestId("card-watchlist-btn");
    const watchedBtn = screen.getByTestId("card-watched-btn");

    expect(favBtn).toHaveAttribute("aria-pressed", "false");
    expect(watchBtn).toHaveAttribute("aria-pressed", "false");
    expect(watchedBtn).toHaveAttribute("aria-pressed", "false");

    // Click favorite button
    fireEvent.click(favBtn);
    expect(favBtn).toHaveAttribute("aria-pressed", "true");

    // Click watchlist button
    fireEvent.click(watchBtn);
    expect(watchBtn).toHaveAttribute("aria-pressed", "true");

    // Click watched button (should deactivate watchlist)
    fireEvent.click(watchedBtn);
    expect(watchedBtn).toHaveAttribute("aria-pressed", "true");
    expect(watchBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("renders as an article when href is not provided", () => {
    renderWithProvider(<MovieCard {...base} ratingText="8.1" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
