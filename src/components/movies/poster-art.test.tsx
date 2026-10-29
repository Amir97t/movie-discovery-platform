import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PosterArt } from "./poster-art";

describe("PosterArt", () => {
  it("renders a skeleton while the image is loading", () => {
    render(<PosterArt art={null} posterUrl="https://moviesapi.codingfront.dev/images/tt0111161.jpg" />);
    expect(screen.getByTestId("poster-skeleton")).toBeInTheDocument();
  });

  it("renders fallback artwork when posterUrl is null", () => {
    render(<PosterArt art={null} posterUrl={null} />);
    expect(screen.getByTestId("poster-fallback")).toBeInTheDocument();
  });

  it("displays local fallback when image loading errors", () => {
    const { container } = render(
      <PosterArt art={null} posterUrl="https://moviesapi.codingfront.dev/images/tt0111161.jpg" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    if (img) {
      fireEvent.error(img);
    }
    expect(screen.getByTestId("poster-fallback")).toBeInTheDocument();
  });

  it("retains container aspect ratio geometry with or without an image", () => {
    const { container: withImg } = render(
      <PosterArt art={null} posterUrl="https://moviesapi.codingfront.dev/images/tt0111161.jpg" className="aspect-[2/3] w-full" />,
    );
    expect(withImg.firstElementChild).toHaveClass("aspect-[2/3]", "w-full");

    const { container: withoutImg } = render(
      <PosterArt art={null} posterUrl={null} className="aspect-[2/3] w-full" />,
    );
    expect(withoutImg.firstElementChild).toHaveClass("aspect-[2/3]", "w-full");
  });
});
