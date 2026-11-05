import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MovieBackdrop } from "./movie-backdrop";

describe("MovieBackdrop", () => {
  it("renders landscape backdrop image when backdropUrl is provided", () => {
    render(
      <MovieBackdrop
        backdropUrl="https://example.com/backdrop.jpg"
        title="Test Movie"
        badge={<span>Badge</span>}
      />
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Test Movie" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-on-art");

    const section = screen.getByTestId("movie-backdrop");
    expect(section).toBeInTheDocument();
    expect(screen.getByText("Badge")).toBeInTheDocument();
  });

  it("renders portrait poster when posterUrl is provided without backdrop", () => {
    render(
      <MovieBackdrop
        posterUrl="/fixtures/posters/quiet-reel.svg"
        art={["#22301f", "#7fa05a"]}
        title="The Quiet Reel"
        badge={<span>Documentary</span>}
      />
    );

    const heading = screen.getByRole("heading", { level: 1, name: "The Quiet Reel" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-fg");

    const posterWrapper = screen.getByTestId("movie-detail-poster");
    expect(posterWrapper).toBeInTheDocument();
    expect(posterWrapper.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("quiet-reel.svg")
    );
  });

  it("renders both backdrop and portrait poster when both are provided", () => {
    render(
      <MovieBackdrop
        backdropUrl="https://example.com/backdrop.jpg"
        posterUrl="https://example.com/poster.jpg"
        title="Cinema Classic"
        badge={<span>Classic</span>}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Cinema Classic" })).toBeInTheDocument();
    expect(screen.getByTestId("movie-detail-poster")).toBeInTheDocument();
  });

  it("renders fallback BrandMark artwork when neither image is provided", () => {
    render(
      <MovieBackdrop
        art={["#1b2437", "#4b6bb0"]}
        title="Midnight Aperture"
        badge={<span>Sample</span>}
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Midnight Aperture" })).toBeInTheDocument();
    expect(screen.queryByTestId("movie-detail-poster")).not.toBeInTheDocument();
    expect(screen.getByTestId("movie-backdrop")).toBeInTheDocument();
  });

  it("renders optional children controls", () => {
    render(
      <MovieBackdrop
        posterUrl="/fixtures/posters/quiet-reel.svg"
        title="The Quiet Reel"
        badge={<span>Documentary</span>}
      >
        <button type="button">Add to Favorites</button>
      </MovieBackdrop>
    );

    expect(screen.getByRole("button", { name: "Add to Favorites" })).toBeInTheDocument();
  });
});
