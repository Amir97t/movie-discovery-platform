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

export function HeroCarousel({ candidates, kicker, locale = "en" }: HeroCarouselProps) {
  const t = useTranslations("home");
  const tm = useTranslations("movie");
  const tg = useTranslations("genres");

  const [slides, setSlides] = useState<Movie[]>(() => candidates.slice(0, 6));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const prefersReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
  const isDocumentHidden = useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, () => false);

  const plainNumber = new Intl.NumberFormat(locale, { useGrouping: false });

  // On client mount: randomize rotation order without hydration mismatch
  useEffect(() => {
    if (candidates.length < 2) return;
    // Keep initial slide deterministic for hydration parity, shuffle subsequent candidates
    const [first, ...rest] = candidates.slice(0, 6);
    const shuffled = [...rest].sort(() => Math.random() - 0.5);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlides([first, ...shuffled]);
  }, [candidates]);

  // Auto-rotation timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const shouldRotate =
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
  }, [isPlaying, isHovered, isFocused, isDocumentHidden, prefersReducedMotion, slides.length, currentIndex]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
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
      aria-label="Featured movie carousel"
      aria-roledescription="carousel"
      className="group relative isolate overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
    >
      {/* Background Slides */}
      <div className="relative h-[24rem] w-full sm:h-[30rem] lg:h-[34rem]">
        {slides.map((movie, index) => {
          const isActive = index === currentIndex;
          const hasError = imageErrors[movie.id];
          const showBackdrop = Boolean(movie.backdropUrl) && !hasError;
          const style = movie.art
            ? { backgroundImage: `linear-gradient(135deg, ${movie.art[0]} 0%, ${movie.art[1]} 100%)` }
            : undefined;

          return (
            <div
              key={movie.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}: ${movie.title}`}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-in-out",
                isActive ? "z-0 opacity-100" : "-z-10 opacity-0 pointer-events-none",
                !showBackdrop && "bg-skeleton",
              )}
              style={style}
            >
              {showBackdrop && (
                <Image
                  src={movie.backdropUrl!}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="object-cover object-center"
                  onError={() => setImageErrors((prev) => ({ ...prev, [movie.id]: true }))}
                />
              )}

              {/* Watermark brand mark on fallback */}
              {(!showBackdrop || hasError) && (
                <BrandMark className="absolute -end-8 -top-8 -z-10 size-72 text-on-art/10 sm:size-96 lg:size-[30rem]" />
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
          <div className="absolute bottom-6 end-6 z-20 flex items-center gap-2 rounded-full border border-line bg-surface/80 p-1.5 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={goToPrev}
              aria-label={t("carouselPrev")}
              className="flex size-8 items-center justify-center rounded-full text-fg hover:bg-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? t("carouselPause") : t("carouselPlay")}
              aria-pressed={!isPlaying}
              className="flex size-8 items-center justify-center rounded-full text-fg hover:bg-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {isPlaying ? (
                <Pause className="size-3.5" aria-hidden="true" />
              ) : (
                <Play className="size-3.5 ms-0.5" aria-hidden="true" />
              )}
            </button>

            {/* Slide Indicator Dots */}
            <div className="flex items-center gap-1.5 px-1.5">
              {slides.map((slide, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goToSlide(idx)}
                    aria-label={t("carouselSlide", { number: idx + 1 })}
                    aria-current={isCurrent ? "true" : undefined}
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

            <button
              type="button"
              onClick={goToNext}
              aria-label={t("carouselNext")}
              className="flex size-8 items-center justify-center rounded-full text-fg hover:bg-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
