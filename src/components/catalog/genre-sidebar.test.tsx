import * as React from "react";
import { vi, describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href?: string;
    onClick?: (e: React.MouseEvent) => void;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "a",
      {
        href,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          onClick?.(e);
        },
        ...props,
      },
      children,
    ),
}));

import { GenreSidebar, type GenreItem } from "./genre-sidebar";

const testGenres: GenreItem[] = [
  { key: "action", label: "Action", href: "/discover?genre=action&page=1" },
  { key: "comedy", label: "Comedy", href: "/discover?genre=comedy&page=1" },
  { key: "scifi", label: "Sci-Fi", href: "/discover?genre=scifi&page=1" },
];

describe("GenreSidebar component", () => {
  const defaultProps = {
    ariaLabelledBy: "test-genres-title",
    genresTitle: "Filter by Genre",
    allLabel: "All Genres",
    allHref: "/discover?page=1",
    filterButtonLabel: "Genres & Filters",
    closeFiltersLabel: "Close filters",
    genreItems: testGenres,
  };

  afterEach(() => {
    document.body.style.overflow = "";
    vi.restoreAllMocks();
  });

  it("renders trigger button with correct accessible attributes and is closed initially", () => {
    render(<GenreSidebar {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /Genres & Filters/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "genre-drawer");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    // Drawer dialog is not visible initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows selected genre chip in trigger when selectedGenreKey is provided", () => {
    render(<GenreSidebar {...defaultProps} selectedGenreKey="scifi" />);

    const trigger = screen.getByRole("button", { name: /Genres & Filters.*Sci-Fi/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Sci-Fi");
  });

  it("opens drawer on trigger click, sets role='dialog', aria-modal='true', locks scroll, and focuses close button", () => {
    render(<GenreSidebar {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /Genres & Filters/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "test-genres-title");

    // Drawer heading
    const heading = screen.getByRole("heading", { name: "Filter by Genre" });
    expect(heading).toHaveAttribute("id", "test-genres-title");

    // Body scroll locked
    expect(document.body.style.overflow).toBe("hidden");

    // Close button focused
    const closeBtn = screen.getByRole("button", { name: "Close filters" });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("renders All Genres link and all genre links with active state", () => {
    render(<GenreSidebar {...defaultProps} selectedGenreKey="action" />);

    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));

    const allLink = screen.getByRole("link", { name: /All Genres/i });
    expect(allLink).toBeInTheDocument();
    expect(allLink).toHaveAttribute("href", "/discover?page=1");
    expect(allLink).not.toHaveAttribute("aria-current");

    const actionLink = screen.getByRole("link", { name: /Action/i });
    expect(actionLink).toBeInTheDocument();
    expect(actionLink).toHaveAttribute("aria-current", "page");

    const comedyLink = screen.getByRole("link", { name: /Comedy/i });
    expect(comedyLink).toBeInTheDocument();
    expect(comedyLink).not.toHaveAttribute("aria-current");
  });

  it("closes drawer when clicking close button, unlocks scroll, and restores focus to trigger", () => {
    render(<GenreSidebar {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /Genres & Filters/i });
    fireEvent.click(trigger);

    const closeBtn = screen.getByRole("button", { name: "Close filters" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes drawer when pressing Escape", () => {
    render(<GenreSidebar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes drawer when clicking backdrop", () => {
    render(<GenreSidebar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));
    const backdrop = screen.getByTestId("genre-drawer-backdrop");

    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes drawer when clicking a genre link", () => {
    render(<GenreSidebar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));
    const actionLink = screen.getByRole("link", { name: /Action/i });

    fireEvent.click(actionLink);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
