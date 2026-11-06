import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiscoverHero } from "./discover-hero";
import type { Movie } from "@/features/catalog/catalog-types";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt?: string;
    [key: string]: unknown;
  }) => {
    const domProps = { ...props };
    delete domProps.fill;
    delete domProps.unoptimized;
    return React.createElement("img", {
      src,
      alt,
      ...domProps,
    });
  },
}));

const mockMovies: Movie[] = [
  {
    id: "m1",
    title: "Cinematic Odyssey",
    year: 2024,
    rating: 8.5,
    runtimeMinutes: 120,
    genres: ["scifi"],
    synopsis: "A journey through space.",
    posterUrl: "/posters/m1.jpg",
    backdropUrl: null,
    art: ["#111", "#222"],
    director: null,
    actors: null,
    country: null,
    imdb_id: null,
    imdb_rating: null,
    website: null,
  },
  {
    id: "m2",
    title: "Shadows in Rain",
    year: 2023,
    rating: 7.9,
    runtimeMinutes: 110,
    genres: ["drama"],
    synopsis: null,
    posterUrl: "/posters/m2.jpg",
    backdropUrl: null,
    art: ["#333", "#444"],
    director: null,
    actors: null,
    country: null,
    imdb_id: null,
    imdb_rating: null,
    website: null,
  },
  {
    id: "m3",
    title: "Golden Hour",
    year: 2022,
    rating: 8.1,
    runtimeMinutes: 95,
    genres: ["romance"],
    synopsis: null,
    posterUrl: "/posters/m3.jpg",
    backdropUrl: null,
    art: ["#555", "#666"],
    director: null,
    actors: null,
    country: null,
    imdb_id: null,
    imdb_rating: null,
    website: null,
  },
];

describe("DiscoverHero", () => {
  it("renders title, subtitle, and kicker badge in English", () => {
    render(
      <DiscoverHero
        title="Discover"
        subtitle="Explore the entire curated catalog"
        kicker="Movies"
        movies={mockMovies}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
    expect(screen.getByText("Explore the entire curated catalog")).toBeInTheDocument();
    expect(screen.getByText("Movies")).toBeInTheDocument();
  });

  it("renders Persian title and subtitle correctly", () => {
    render(
      <DiscoverHero
        title="کاوش در دنیای فیلم‌ها"
        subtitle="مرور کامل کاتالوگ"
        kicker="فیلم‌ها"
        movies={mockMovies}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "کاوش در دنیای فیلم‌ها" })).toBeInTheDocument();
    expect(screen.getByText("مرور کامل کاتالوگ")).toBeInTheDocument();
    expect(screen.getByText("فیلم‌ها")).toBeInTheDocument();
  });

  it("renders poster collage with active movie artwork", () => {
    const { container } = render(
      <DiscoverHero
        title="Discover"
        subtitle="Explore the entire curated catalog"
        movies={mockMovies}
      />,
    );

    const collage = screen.getByTestId("discover-hero-collage");
    expect(collage).toBeInTheDocument();

    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(3);
    const srcs = Array.from(images).map((img) => img.getAttribute("src"));
    expect(srcs).toContain("/posters/m1.jpg");
    expect(srcs).toContain("/posters/m2.jpg");
    expect(srcs).toContain("/posters/m3.jpg");
  });

  it("falls back to fixture artwork when movie list is empty", () => {
    const { container } = render(
      <DiscoverHero
        title="Discover"
        subtitle="Explore the entire curated catalog"
        movies={[]}
      />,
    );

    const collage = screen.getByTestId("discover-hero-collage");
    expect(collage).toBeInTheDocument();
    // At least 3 cards are rendered from fixtures
    expect(container.querySelectorAll("[data-poster-status]").length).toBe(3);
  });

  it("has correct layout classes for desktop height and mobile adaptation", () => {
    render(
      <DiscoverHero
        title="Discover"
        subtitle="Explore the entire curated catalog"
        movies={mockMovies}
      />,
    );

    const hero = screen.getByTestId("discover-hero");
    expect(hero).toHaveClass("min-h-[220px]", "sm:h-72", "lg:h-[280px]");
    expect(hero).toHaveClass("rounded-3xl", "border", "border-line/60");
  });
});
