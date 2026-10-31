"use client";

import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface IndicatorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiquidIndicatorResult {
  isVisible: boolean;
  rect: IndicatorRect | null;
  wrapperStyle: CSSProperties;
  stretchClass: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Reusable hook that tracks the bounding box of the active navigation item
 * relative to its container. Provides geometry, spring transitions, and
 * directional stretch classes for liquid navigation indicators.
 */
export function useLiquidIndicator(
  containerRef: RefObject<HTMLElement | null>,
  pathname: string,
): LiquidIndicatorResult {
  const isMountedRef = useRef(false);
  const prevRectRef = useRef<IndicatorRect | null>(null);

  const [rect, setRect] = useState<IndicatorRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [stretch, setStretch] = useState<"right" | "left" | null>(null);

  // Clear stretch animation after duration
  useEffect(() => {
    if (!stretch) return;
    const timer = setTimeout(() => {
      setStretch(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [stretch]);

  // Track active link changes
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) {
      setRect(null);
      return;
    }

    const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeEl) {
      setRect(null);
      prevRectRef.current = null;
      return;
    }

    const aRect = activeEl.getBoundingClientRect();
    if (aRect.width === 0 || aRect.height === 0) {
      setRect(null);
      return;
    }

    const nextRect: IndicatorRect = {
      x: aRect.left - cRect.left,
      y: aRect.top - cRect.top,
      width: aRect.width,
      height: aRect.height,
    };

    if (!isMountedRef.current || !prevRectRef.current) {
      // First measurement: apply immediately without transition
      isMountedRef.current = true;
      setRect(nextRect);
      prevRectRef.current = nextRect;
      const raf = requestAnimationFrame(() => {
        setIsReady(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    // Subsequent route change: compute travel delta
    const deltaX = nextRect.x - prevRectRef.current.x;
    if (Math.abs(deltaX) > 2) {
      setStretch(deltaX > 0 ? "right" : "left");
    } else {
      setStretch(null);
    }

    setRect(nextRect);
    prevRectRef.current = nextRect;
  }, [pathname, containerRef]);

  // Recalculate on window resize / layout changes without spatial transition
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!activeEl) return;

      const cRect = container.getBoundingClientRect();
      const aRect = activeEl.getBoundingClientRect();
      if (cRect.width === 0 || aRect.width === 0) return;

      const nextRect: IndicatorRect = {
        x: aRect.left - cRect.left,
        y: aRect.top - cRect.top,
        width: aRect.width,
        height: aRect.height,
      };

      setRect(nextRect);
      prevRectRef.current = nextRect;
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef]);

  const reducedMotion = prefersReducedMotion();
  const isVisible = Boolean(rect && isReady);

  const wrapperStyle: CSSProperties = rect
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        transition:
          isReady && !reducedMotion
            ? "transform 380ms cubic-bezier(0.25, 1.15, 0.45, 1), width 380ms cubic-bezier(0.25, 1.15, 0.45, 1), height 380ms cubic-bezier(0.25, 1.15, 0.45, 1)"
            : "none",
        pointerEvents: "none",
      }
    : {};

  const stretchClass =
    !reducedMotion && stretch === "right"
      ? "animate-liquid-stretch-right"
      : !reducedMotion && stretch === "left"
        ? "animate-liquid-stretch-left"
        : "";

  return {
    isVisible,
    rect,
    wrapperStyle,
    stretchClass,
  };
}
