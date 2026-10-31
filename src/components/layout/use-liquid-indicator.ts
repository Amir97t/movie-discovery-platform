"use client";

import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
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

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  try {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", callback);
    return () => {
      media.removeEventListener("change", callback);
    };
  } catch {
    return () => {};
  }
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getServerSnapshot);
}

function measureActiveRect(container: HTMLElement): IndicatorRect | null {
  const cRect = container.getBoundingClientRect();
  if (cRect.width === 0 || cRect.height === 0) return null;

  const activeEl = container.querySelector<HTMLElement>('[aria-current="page"]');
  if (!activeEl) return null;

  const aRect = activeEl.getBoundingClientRect();
  if (aRect.width === 0 || aRect.height === 0) return null;

  return {
    x: aRect.left - cRect.left,
    y: aRect.top - cRect.top,
    width: aRect.width,
    height: aRect.height,
  };
}

/**
 * Reusable hook that tracks the bounding box of the active navigation item
 * relative to its container. Provides geometry, spring transitions, and
 * directional stretch classes for liquid navigation indicators.
 * Reliably handles breakpoint transitions, window resizes, and reduced motion.
 */
export function useLiquidIndicator(
  containerRef: RefObject<HTMLElement | null>,
  pathname: string,
): LiquidIndicatorResult {
  const isReadyRef = useRef(false);
  const prevRectRef = useRef<IndicatorRect | null>(null);
  const prevContainerSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const isResizingRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rect, setRect] = useState<IndicatorRect | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [stretch, setStretch] = useState<"right" | "left" | null>(null);

  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  // Clear stretch animation after duration
  useEffect(() => {
    if (!stretch) return;
    const timer = setTimeout(() => {
      setStretch(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [stretch]);

  // Track active link changes on route navigation
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const nextRect = measureActiveRect(container);
    if (!nextRect) {
      setRect(null);
      if (!container.querySelector('[aria-current="page"]')) {
        prevRectRef.current = null;
      }
      return;
    }

    if (!prevRectRef.current) {
      // First measurement while visible: apply immediately without animation
      setRect(nextRect);
      prevRectRef.current = nextRect;
      isReadyRef.current = true;
      setIsReady(true);
      return;
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

  // Handle breakpoint visibility changes and window resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      const cRect = container.getBoundingClientRect();
      const prev = prevContainerSizeRef.current;
      // Only act if container dimensions actually changed (breakpoint or window resize)
      if (Math.abs(cRect.width - prev.width) < 1 && Math.abs(cRect.height - prev.height) < 1) {
        return;
      }
      prevContainerSizeRef.current = { width: cRect.width, height: cRect.height };

      const nextRect = measureActiveRect(container);
      if (!nextRect) {
        setRect(null);
        return;
      }

      if (!isReadyRef.current || !prevRectRef.current) {
        // Breakpoint transition from hidden to visible: initialize immediately without transition
        setRect(nextRect);
        prevRectRef.current = nextRect;
        isReadyRef.current = true;
        setIsReady(true);
        return;
      }

      // Continuous resize while visible: re-anchor with zero transition lag
      if (!isResizingRef.current) {
        isResizingRef.current = true;
        setIsResizing(true);
      }
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        isResizingRef.current = false;
        setIsResizing(false);
      }, 120);

      setRect(nextRect);
      prevRectRef.current = nextRect;
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [containerRef]);

  const reducedMotion = useReducedMotion();
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
          isReady && !reducedMotion && !isResizing
            ? "transform 380ms cubic-bezier(0.25, 1.15, 0.45, 1), width 380ms cubic-bezier(0.25, 1.15, 0.45, 1), height 380ms cubic-bezier(0.25, 1.15, 0.45, 1)"
            : "none",
        pointerEvents: "none",
      }
    : {};

  const stretchClass =
    !reducedMotion && !isResizing && stretch === "right"
      ? "animate-liquid-stretch-right"
      : !reducedMotion && !isResizing && stretch === "left"
        ? "animate-liquid-stretch-left"
        : "";

  return {
    isVisible,
    rect,
    wrapperStyle,
    stretchClass,
  };
}
