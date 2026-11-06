"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/ui/brand-mark";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { Movie } from "@/features/catalog/catalog-types";

export interface HeroCarouselProps {
  candidates: Movie[];
  kicker?: string;
  locale?: string;
}

const ROTATION_INTERVAL_MS = 7000;

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener?.("change", callback);
  return () => mediaQuery.removeEventListener?.("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeVisibility(callback: () => void) {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function getVisibilitySnapshot() {
  if (typeof document === "undefined") return false;
  return document.hidden;
}

function subscribeDesktop(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mediaQuery = window.matchMedia("(min-width: 1024px)");
  mediaQuery.addEventListener?.("change", callback);
  return () => mediaQuery.removeEventListener?.("change", callback);
}

function getDesktopSnapshot() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(min-width: 1024px)").matches;
}

export function HeroCarousel({ candidates, kicker, locale = "en" }: HeroCarouselProps) {
  const t = useTranslations("home");
  const tm = useTranslations("movie");
  const tg = useTranslations("genres");

  // Candidates are ordered deterministically in descending rating order from getHeroCandidates(),
  // ensuring the initial slide matches between server-render and client hydration without mismatches.
  const slides = candidates.slice(0, 6);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Track image load failures per slide to cascade gracefully through fallback hierarchy
  const [backdropErrors, setBackdropErrors] = useState<Record<string, boolean>>({});
  const [posterErrors, setPosterErrors] = useState<Record<string, boolean>>({});

  const prefersReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
  const isDocumentHidden = useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, () => false);
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);

  const plainNumber = new Intl.NumberFormat(locale, { useGrouping: false });

  // Touch & swipe gesture handling for mobile & tablet navigation
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  // Auto-rotation timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const shouldRotate =
      isDesktop &&
      isPlaying &&
      !isHovered &&
      !isFocused &&
      !isDocumentHidden &&
      !prefersReducedMotion &&
      slides.length > 1;

    if (shouldRotate) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
      }, ROTATION_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDesktop, isPlaying, isHovered, isFocused, isDocumentHidden, prefersReducedMotion, slides.length, currentIndex]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    // Ignore gestures starting on interactive elements (links, buttons, inputs)
    if (target && target.closest("a, button, [role='button'], input, select, textarea")) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // If vertical movement dominates, allow native page scroll
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    const isRtl =
      typeof document !== "undefined" &&
      (document.documentElement.lang === "fa" || document.documentElement.dir === "rtl");

    const SWIPE_THRESHOLD = 45;
    if (deltaX < -SWIPE_THRESHOLD) {
      if (isRtl) {
        goToPrev();
      } else {
        goToNext();
      }
    } else if (deltaX > SWIPE_THRESHOLD) {
      if (isRtl) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle Arrow keys
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") {
      return;
    }
    // Do not intercept if focus is on an interactive child element (input, textarea, link, button)
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLButtonElement ||
      e.target instanceof HTMLAnchorElement
    ) {
      return;
    }
    const isRtl =
      typeof document !== "undefined" &&
      (document.documentElement.lang === "fa" || document.documentElement.dir === "rtl");

    e.preventDefault();
    if (e.key === "ArrowLeft") {
      if (isRtl) {
        goToNext();
      } else {
        goToPrev();
      }
    } else if (e.key === "ArrowRight") {
      if (isRtl) {
        goToPrev();
      } else {
        goToNext();
      }
    }
  };

  if (!slides || slides.length === 0) {
    return null;
  }

  const activeMovie = slides[currentIndex] ?? slides[0];
  const activeKicker = kicker ?? t("heroKickerApi");

  const metaFor = (movie: Movie): string => {
    const parts: string[] = [];
    const firstGenre = movie.genres[0];
    if (firstGenre) {
      try {
        parts.push(tg(firstGenre as Parameters<typeof tg>[0]));
      } catch {
        parts.push(firstGenre);
      }
    }
    if (movie.year !== null) parts.push(plainNumber.format(movie.year));
    if (movie.runtimeMinutes !== null) {
      parts.push(tm("minutes", { value: plainNumber.format(movie.runtimeMinutes) }));
    }
    return parts.join(" · ");
  };

  return (
    <section
      tabIndex={0}
      aria-label={t("carouselRegion")}
      aria-roledescription="carousel"
      className="group relative isolate overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all duration-300 touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Prevent focus moving between controls inside the carousel from disabling pause
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Slides */}
      <div className="relative h-[24rem] w-full sm:h-[30rem] lg:h-[34rem]">
        {slides.map((movie, index) => {
          const isActive = index === currentIndex;
          const hasBackdropError = Boolean(backdropErrors[movie.id]);
          const hasPosterError = Boolean(posterErrors[movie.id]);

          // Artwork fallback hierarchy:
          // 1. Prefer backdropUrl
          // 2. If no backdrop (or error), use posterUrl in cinematic layout
          // 3. If neither (or both error), use fixture gradient artwork if available
          // 4. Use BrandMark as final watermark fallback
          const showBackdrop = Boolean(movie.backdropUrl) && !hasBackdropError;
          const showPoster = !showBackdrop && Boolean(movie.posterUrl) && !hasPosterError;
          const showFixtureArt = !showBackdrop && !showPoster && Boolean(movie.art);

          const fixtureStyle = showFixtureArt && movie.art
            ? { backgroundImage: `linear-gradient(135deg, ${movie.art[0]} 0%, ${movie.art[1]} 100%)` }
            : undefined;

          return (
            <div
              key={movie.id}
              role="group"
              aria-roledescription="slide"
              aria-label={t("carouselSlideLabel", {
                current: index + 1,
                total: slides.length,
                title: movie.title,
              })}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-in-out",
                isActive ? "z-0 opacity-100" : "-z-10 opacity-0 pointer-events-none",
                !showBackdrop && !showPoster && !showFixtureArt && "bg-skeleton",
              )}
              style={fixtureStyle}
            >
              {/* 1. Primary Backdrop Image */}
              {showBackdrop && (
                <Image
                  src={movie.backdropUrl!}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="object-cover object-center"
                  onError={() => setBackdropErrors((prev) => ({ ...prev, [movie.id]: true }))}
                />
              )}

              {/* 2. Poster Fallback in Cinematic Layout */}
              {showPoster && (
                <div className="absolute inset-0 overflow-hidden" data-testid="poster-fallback-layout">
                  {/* Ambient blurred backdrop created from poster */}
                  <Image
                    src={movie.posterUrl!}
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover object-center scale-110 blur-xl opacity-40 brightness-75"
                    aria-hidden="true"
                  />
                  {/* Crisp poster card accent placed in background */}
                  <div className="absolute inset-y-8 end-8 hidden sm:flex items-center justify-center lg:end-16 z-0 pointer-events-none">
                    <div className="relative h-4/5 aspect-[2/3] overflow-hidden rounded-xl border border-line-strong/40 shadow-2xl">
                      <Image
                        src={movie.posterUrl!}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 320px, 240px"
                        className="object-cover"
                        onError={() => setPosterErrors((prev) => ({ ...prev, [movie.id]: true }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Fixture Artwork Fallback (handled by style={fixtureStyle}) */}

              {/* 4. Final BrandMark watermark fallback (when neither image is present or both failed) */}
              {(!showBackdrop && !showPoster) && (
                <BrandMark
                  data-testid="hero-brandmark-fallback"
                  className="absolute -end-8 -top-8 -z-10 size-72 text-on-art/10 sm:size-96 lg:size-[30rem]"
                />
              )}
            </div>
          );
        })}

        {/* Multi-directional legibility scrims protecting copy in LTR and RTL */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--scrim)]/80 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--background)]/90 via-[var(--background)]/40 to-transparent rtl:bg-gradient-to-l rtl:from-[var(--background)]/90 rtl:via-[var(--background)]/40 rtl:to-transparent"
        />

        {/* Active Content Overlay */}
        <div className="relative z-10 flex h-full max-w-2xl flex-col justify-end gap-3 p-6 text-on-art sm:p-8 lg:p-12">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-text shadow-sm backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              {activeKicker}
            </span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-on-art drop-shadow-md leading-tight">
            <Link
              href={`/movies/${activeMovie.id}`}
              className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              {activeMovie.title}
            </Link>
          </h2>

          <p className="text-sm font-medium text-on-art/80 sm:text-base">
            {metaFor(activeMovie)}
          </p>

          {activeMovie.synopsis && (
            <p className="hidden line-clamp-3 text-sm leading-relaxed text-on-art/85 md:block sm:text-base">
              {activeMovie.synopsis}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/movies/${activeMovie.id}`}
              className={buttonStyles({ size: "lg" })}
            >
              {t("viewDetails")}
            </Link>
            <a
              href="#catalog"
              className={buttonStyles({ size: "lg", variant: "secondary" })}
            >
              {t("heroCta")}
            </a>
          </div>
        </div>

        {/* Carousel Navigation Controls (only if multiple slides exist) */}
        {slides.length > 1 && (
          <>
            {/* 1. Previous Slide Edge Arrow (Logical start, vertically centered, visible across all viewports with >=44px hit target) */}
            <button
              type="button"
              onClick={goToPrev}
              aria-label={t("carouselPrev")}
              className={cn(
                "group/btn absolute start-2 sm:start-4 lg:start-6 top-1/2 -translate-y-1/2 z-20",
                "flex size-11 items-center justify-center touch-manipulation rounded-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-9 sm:size-10 lg:size-11 items-center justify-center rounded-full",
                  "border border-line/60 bg-surface/75 sm:bg-surface/60 text-fg shadow-lg backdrop-blur-md",
                  "opacity-90 sm:opacity-75 group-hover/btn:!opacity-100 group-hover/btn:bg-surface/90 group-hover/btn:scale-105 active:scale-95",
                  "transition-all duration-200",
                )}
              >
                <ChevronLeft className="size-4 sm:size-5 rtl:rotate-180" aria-hidden="true" />
              </span>
            </button>

            {/* 2. Next Slide Edge Arrow (Logical end, vertically centered, visible across all viewports with >=44px hit target) */}
            <button
              type="button"
              onClick={goToNext}
              aria-label={t("carouselNext")}
              className={cn(
                "group/btn absolute end-2 sm:end-4 lg:end-6 top-1/2 -translate-y-1/2 z-20",
                "flex size-11 items-center justify-center touch-manipulation rounded-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              <span
                className={cn(
                  "flex size-9 sm:size-10 lg:size-11 items-center justify-center rounded-full",
                  "border border-line/60 bg-surface/75 sm:bg-surface/60 text-fg shadow-lg backdrop-blur-md",
                  "opacity-90 sm:opacity-75 group-hover/btn:!opacity-100 group-hover/btn:bg-surface/90 group-hover/btn:scale-105 active:scale-95",
                  "transition-all duration-200",
                )}
              >
                <ChevronRight className="size-4 sm:size-5 rtl:rotate-180" aria-hidden="true" />
              </span>
            </button>

            {/* 3. Pause / Play Button (Upper logical corner, away from title & CTA) */}
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? t("carouselPause") : t("carouselPlay")}
              aria-pressed={!isPlaying}
              className={cn(
                "absolute top-4 end-4 sm:top-6 sm:end-6 z-20",
                "hidden lg:flex size-9 items-center justify-center rounded-full",
                "border border-line/60 bg-surface/60 text-fg shadow-md backdrop-blur-md",
                "opacity-75 group-hover:opacity-100 hover:!opacity-100 hover:bg-surface/90 hover:scale-105",
                "transition-all duration-200",
                "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              {isPlaying ? (
                <Pause className="size-3.5" aria-hidden="true" />
              ) : (
                <Play className="size-3.5 ms-0.5" aria-hidden="true" />
              )}
            </button>

            {/* 4. Slide Indicator Dots (Centered at bottom, visible on lg, hidden below lg) */}
            <div className="absolute bottom-4 inset-x-0 z-20 hidden lg:flex justify-center pointer-events-none">
              <div
                className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line/40 bg-surface/50 px-3 py-1.5 backdrop-blur-md"
                role="tablist"
                aria-label={t("carouselRegion")}
              >
                {slides.map((slide, idx) => {
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      role="tab"
                      onClick={() => goToSlide(idx)}
                      aria-label={t("carouselSlide", { number: idx + 1 })}
                      aria-selected={isCurrent}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        isCurrent
                          ? "w-6 bg-accent"
                          : "w-2 bg-muted/40 hover:bg-muted/70",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
