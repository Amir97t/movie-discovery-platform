import * as React from "react";
import { vi, describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

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
}));

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
    delete domProps.priority;
    return React.createElement("img", { src, alt, ...domProps });
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const dicts: Record<string, Record<string, string>> = {
      home: {
        heroKickerApi: "Featured Tonight",
        heroCta: "Browse Catalog",
        viewDetails: "View Details",
        carouselPrev: "Previous slide",
        carouselNext: "Next slide",
        carouselPlay: "Play carousel",
        carouselPause: "Pause carousel",
        carouselSlide: "Go to slide {number}",
      },
      movie: {
        minutes: "{value} min",
        ratingValue: "Rating {value}",
        notRated: "Not rated",
      },
      genres: {
        action: "Action",
        scifi: "Sci-Fi",
        drama: "Drama",
      },
    };
    return (key: string, params?: Record<string, unknown>) => {
      let val = dicts[namespace]?.[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          val = val.replace(`{${k}}`, String(v));
        }
      }
      return val;
    };
  },
}));

import { HeroCarousel } from "./hero-carousel";
import type { Movie } from "@/features/catalog/catalog-types";

const createTestMovie = (partial: Partial<Movie> & { id: string; title: string }): Movie => ({
  year: 2024,
  rating: 8.0,
  runtimeMinutes: 120,
  genres: ["action"],
  synopsis: null,
  posterUrl: null,
  backdropUrl: null,
  art: ["#000", "#fff"],
  director: null,
  actors: null,
  country: null,
  imdb_id: null,
  imdb_rating: null,
  website: null,
  ...partial,
});

const mockCandidates: Movie[] = [
  createTestMovie({
    id: "1",
    title: "Movie One",
    year: 2021,
    rating: 8.5,
    runtimeMinutes: 120,
    genres: ["action"],
    synopsis: "First movie synopsis",
    posterUrl: "/posters/1.jpg",
    backdropUrl: "/backdrops/1.jpg",
    art: ["#111", "#222"],
  }),
  createTestMovie({
    id: "2",
    title: "Movie Two",
    year: 2022,
    rating: 7.9,
    runtimeMinutes: 110,
    genres: ["scifi"],
    synopsis: "Second movie synopsis",
    posterUrl: "/posters/2.jpg",
    backdropUrl: "/backdrops/2.jpg",
    art: ["#333", "#444"],
  }),
  createTestMovie({
    id: "3",
    title: "Movie Three",
    year: 2023,
    rating: 9.0,
    runtimeMinutes: 140,
    genres: ["drama"],
    synopsis: "Third movie synopsis",
    posterUrl: "/posters/3.jpg",
    backdropUrl: null,
    art: ["#555", "#666"],
  }),
];

describe("HeroCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders deterministic initial slide for hydration safety", () => {
    render(<HeroCarousel candidates={mockCandidates} />);

    // First slide title is rendered and points to /movies/1
    const heading = screen.getByRole("heading", { level: 2, name: "Movie One" });
    expect(heading).toBeInTheDocument();
    const detailLink = screen.getByRole("link", { name: "View Details" });
    expect(detailLink).toHaveAttribute("href", "/movies/1");
  });

  it("navigates to next slide on Next button click", () => {
    render(<HeroCarousel candidates={mockCandidates} />);

    expect(screen.getByRole("heading", { level: 2, name: "Movie One" })).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: "Next slide" });
    fireEvent.click(nextBtn);

    // After clicking next, current slide is slide 2
    const dot2 = screen.getByRole("button", { name: "Go to slide 2" });
    expect(dot2).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("heading", { level: 2, name: "Movie One" })).not.toBeInTheDocument();
  });

  it("navigates to previous slide on Previous button click", () => {
    render(<HeroCarousel candidates={mockCandidates} />);

    const prevBtn = screen.getByRole("button", { name: "Previous slide" });
    fireEvent.click(prevBtn);

    // Wraps around to last slide (slide 3)
    const dot3 = screen.getByRole("button", { name: "Go to slide 3" });
    expect(dot3).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("heading", { level: 2, name: "Movie One" })).not.toBeInTheDocument();
  });

  it("pauses and plays rotation when play/pause button is clicked", () => {
    render(<HeroCarousel candidates={mockCandidates} />);

    const pauseBtn = screen.getByRole("button", { name: "Pause carousel" });
    fireEvent.click(pauseBtn);

    // Now button indicates play
    const playBtn = screen.getByRole("button", { name: "Play carousel" });
    expect(playBtn).toBeInTheDocument();

    // Fast forward 7 seconds: index should NOT advance because it's paused
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(screen.getByRole("heading", { level: 2, name: "Movie One" })).toBeInTheDocument();

    // Click play to resume
    fireEvent.click(playBtn);
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(screen.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("heading", { level: 2, name: "Movie One" })).not.toBeInTheDocument();
  });

  it("automatically advances after 7 seconds when playing", () => {
    render(<HeroCarousel candidates={mockCandidates} />);

    expect(screen.getByRole("heading", { level: 2, name: "Movie One" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(screen.getByRole("button", { name: "Go to slide 2" })).toHaveAttribute("aria-current", "true");
    expect(screen.queryByRole("heading", { level: 2, name: "Movie One" })).not.toBeInTheDocument();
  });

  it("renders static hero when only 1 candidate exists without controls", () => {
    render(<HeroCarousel candidates={[mockCandidates[0]]} />);

    expect(screen.getByRole("heading", { level: 2, name: "Movie One" })).toBeInTheDocument();
    // Controls should not exist for single slide
    expect(screen.queryByRole("button", { name: "Next slide" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous slide" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause carousel" })).not.toBeInTheDocument();
  });
});
