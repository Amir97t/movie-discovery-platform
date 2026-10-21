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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MovieCard } from "./movie-card";

const base = {
  title: "Salt Line",
  metaText: "Drama · 2022 · 131 min",
  ratingLabel: "Rating 8.1 out of 10",
  notRatedLabel: "Not rated",
  art: ["#2f2a28", "#a89b8c"] as const,
};

describe("MovieCard", () => {
  it("shows title, meta and an accessible rating", () => {
    render(<MovieCard {...base} ratingText="8.1" />);
    expect(screen.getByRole("heading", { level: 3, name: "Salt Line" })).toBeInTheDocument();
    expect(screen.getByText("Drama · 2022 · 131 min")).toBeInTheDocument();
    expect(screen.getByText("Rating 8.1 out of 10")).toBeInTheDocument();
  });

  it("shows a not-rated label instead of a number when rating is missing", () => {
    render(<MovieCard {...base} ratingText={null} ratingLabel="" />);
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });

  it("keeps the full long title in the DOM (clamping is visual only)", () => {
    const long = "Long Take, Longer Night: The Complete Untold Story of a Single Evening on Platform Nine";
    render(<MovieCard {...base} title={long} ratingText="6.5" />);
    expect(screen.getByRole("heading", { name: long })).toBeInTheDocument();
  });

  it("renders without artwork data", () => {
    render(<MovieCard {...base} art={null} metaText="" ratingText={null} ratingLabel="" />);
    expect(screen.getByRole("heading", { name: "Salt Line" })).toBeInTheDocument();
  });

  it("renders as a link when href is provided", () => {
    render(<MovieCard {...base} ratingText="8.1" href="/en/movies/1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/en/movies/1");
  });

  it("renders as an article when href is not provided", () => {
    render(<MovieCard {...base} ratingText="8.1" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
