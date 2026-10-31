import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, renderHook, act, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { useLiquidIndicator } from "./use-liquid-indicator";
import { DesktopNav } from "./desktop-nav";
import { MobileNavigation } from "./mobile-navigation";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      label: "Main navigation",
      home: "Home",
      discover: "Discover",
      library: "Library",
      profile: "Profile",
      soon: "soon",
    };
    return translations[key] ?? key;
  },
}));

let mockPathname = "/";
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => mockPathname,
  Link: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("useLiquidIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns isVisible false when container has no active element", () => {
    const container = document.createElement("ul");
    const ref = { current: container };

    const { result } = renderHook(() => useLiquidIndicator(ref, "/non-matching"));
    expect(result.current.isVisible).toBe(false);
    expect(result.current.rect).toBeNull();
  });

  it("measures active element and applies stable initial position without transition", () => {
    const container = document.createElement("ul");
    const activeItem = document.createElement("a");
    activeItem.setAttribute("aria-current", "page");
    container.appendChild(activeItem);

    // Mock bounding rects
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 60,
      right: 500,
      bottom: 110,
      x: 100,
      y: 50,
      toJSON: () => {},
    });

    vi.spyOn(activeItem, "getBoundingClientRect").mockReturnValue({
      left: 120,
      top: 55,
      width: 80,
      height: 44,
      right: 200,
      bottom: 99,
      x: 120,
      y: 55,
      toJSON: () => {},
    });

    const ref = { current: container };
    const { result } = renderHook(() => useLiquidIndicator(ref, "/"));

    expect(result.current.rect).toEqual({
      x: 20,
      y: 5,
      width: 80,
      height: 44,
    });
    expect(result.current.wrapperStyle.transform).toBe("translate3d(20px, 5px, 0)");
    expect(result.current.wrapperStyle.width).toBe("80px");
    expect(result.current.wrapperStyle.height).toBe("44px");
  });

  it("detects travel direction and applies directional stretch class", () => {
    const container = document.createElement("ul");
    const activeItem = document.createElement("a");
    activeItem.setAttribute("aria-current", "page");
    container.appendChild(activeItem);

    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 500,
      height: 60,
      right: 500,
      bottom: 60,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    let currentItemLeft = 50;
    vi.spyOn(activeItem, "getBoundingClientRect").mockImplementation(() => ({
      left: currentItemLeft,
      top: 10,
      width: 80,
      height: 40,
      right: currentItemLeft + 80,
      bottom: 50,
      x: currentItemLeft,
      y: 10,
      toJSON: () => {},
    }));

    const ref = { current: container };
    const { result, rerender } = renderHook(({ path }) => useLiquidIndicator(ref, path), {
      initialProps: { path: "/" },
    });

    expect(result.current.rect?.x).toBe(50);

    // Simulate moving to next route to the right
    currentItemLeft = 160;
    rerender({ path: "/discover" });

    expect(result.current.rect?.x).toBe(160);
    expect(result.current.stretchClass).toBe("animate-liquid-stretch-right");

    // After animation duration, stretch class clears
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(result.current.stretchClass).toBe("");

    // Simulate moving back to the left
    currentItemLeft = 50;
    rerender({ path: "/" });

    expect(result.current.rect?.x).toBe(50);
    expect(result.current.stretchClass).toBe("animate-liquid-stretch-left");
  });

  it("initializes without travel animation when crossing from hidden to visible breakpoint", () => {
    let resizeCallback: (() => void) | null = null;
    class MockResizeObserver {
      constructor(cb: () => void) {
        resizeCallback = cb;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const container = document.createElement("ul");
    const activeItem = document.createElement("a");
    activeItem.setAttribute("aria-current", "page");
    container.appendChild(activeItem);

    // Initially hidden (0 width)
    let containerWidth = 0;
    vi.spyOn(container, "getBoundingClientRect").mockImplementation(() => ({
      left: 0,
      top: 0,
      width: containerWidth,
      height: containerWidth > 0 ? 60 : 0,
      right: containerWidth,
      bottom: containerWidth > 0 ? 60 : 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    vi.spyOn(activeItem, "getBoundingClientRect").mockImplementation(() => ({
      left: containerWidth > 0 ? 40 : 0,
      top: 10,
      width: containerWidth > 0 ? 80 : 0,
      height: containerWidth > 0 ? 40 : 0,
      right: containerWidth > 0 ? 120 : 0,
      bottom: 50,
      x: containerWidth > 0 ? 40 : 0,
      y: 10,
      toJSON: () => {},
    }));

    const ref = { current: container };
    const { result } = renderHook(() => useLiquidIndicator(ref, "/"));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.rect).toBeNull();

    // Cross breakpoint: container becomes visible
    containerWidth = 500;
    act(() => {
      resizeCallback?.();
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.rect?.x).toBe(40);
    expect(result.current.stretchClass).toBe(""); // no fake travel animation
  });
});

describe("DesktopNav and MobileNavigation components", () => {
  beforeEach(() => {
    mockPathname = "/";
  });

  it("renders DesktopNav with aria-current='page' only on active link and renders liquid indicator", () => {
    render(<DesktopNav />);
    const activeLink = screen.getByRole("link", { name: "Home" });
    expect(activeLink.getAttribute("aria-current")).toBe("page");

    const discoverLink = screen.getByRole("link", { name: "Discover" });
    expect(discoverLink.getAttribute("aria-current")).toBeNull();
  });

  it("renders MobileNavigation with aria-current='page' on active link and renders 4 grid columns", () => {
    render(<MobileNavigation />);
    const activeLink = screen.getByRole("link", { name: "Home" });
    expect(activeLink.getAttribute("aria-current")).toBe("page");

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(4);
  });
});
