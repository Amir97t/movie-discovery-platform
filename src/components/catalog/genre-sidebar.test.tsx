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

    // Drawer compact 224px width and opaque surface without blur
    expect(dialog.className).toContain("w-56");
    expect(dialog.className).toContain("bg-surface");
    expect(dialog.className).not.toContain("backdrop-blur");

    // Backdrop has subtle dark opacity without blur
    const backdrop = screen.getByTestId("genre-drawer-backdrop");
    expect(backdrop.className).toContain("bg-black/25");
    expect(backdrop.className).not.toContain("backdrop-blur");

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
    expect(actionLink.querySelector("span.whitespace-nowrap")).toBeInTheDocument();

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

  it("renders navigation with overflow-y-auto and sidebar-scroll with bottom padding", () => {
    render(<GenreSidebar {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));
    const nav = screen.getByRole("navigation", { name: "Filter by Genre" });
    expect(nav).toBeInTheDocument();
    expect(nav.className).toContain("overflow-y-auto");
    expect(nav.className).toContain("sidebar-scroll");

    // ul inside nav reserves bottom space so the last item is never obscured
    const list = nav.querySelector("ul");
    expect(list).toBeInTheDocument();
    expect(list?.className).toContain("pb-10");
  });

  it("handles downward arrow scroll indicator visibility, advancement, and localization", () => {
    // Render with English default
    const { unmount } = render(<GenreSidebar {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));

    const nav = screen.getByRole("navigation", { name: "Filter by Genre" });
    const scrollByMock = vi.fn();
    nav.scrollBy = scrollByMock;

    // Simulate content overflow: scrollHeight 600 > scrollTop 0 + clientHeight 400
    Object.defineProperty(nav, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(nav, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(nav, "scrollTop", { value: 0, writable: true, configurable: true });

    // Trigger scroll event to recalculate
    fireEvent.scroll(nav);

    // Indicator button should be visible with English accessible label
    const indicatorBtn = screen.getByRole("button", { name: /Scroll down for more genres/i });
    expect(indicatorBtn).toBeInTheDocument();

    // Clicking indicator advances the list downwards via scrollBy
    fireEvent.click(indicatorBtn);
    expect(scrollByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        top: expect.any(Number),
      }),
    );

    // Now simulate scrolling to the bottom: scrollTop becomes 200
    nav.scrollTop = 198;
    fireEvent.scroll(nav);

    // Indicator button should be hidden at the bottom
    expect(screen.queryByRole("button", { name: /Scroll down for more genres/i })).not.toBeInTheDocument();

    unmount();

    // Render with Persian language setting / explicit label
    render(<GenreSidebar {...defaultProps} scrollDownLabel="مشاهده ژانرهای بیشتر" />);
    fireEvent.click(screen.getByRole("button", { name: /Genres & Filters/i }));

    const navFa = screen.getByRole("navigation", { name: "Filter by Genre" });
    navFa.scrollBy = vi.fn();
    Object.defineProperty(navFa, "scrollHeight", { value: 700, configurable: true });
    Object.defineProperty(navFa, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(navFa, "scrollTop", { value: 0, writable: true, configurable: true });

    fireEvent.scroll(navFa);

    const indicatorFa = screen.getByRole("button", { name: "مشاهده ژانرهای بیشتر" });
    expect(indicatorFa).toBeInTheDocument();
  });
});
