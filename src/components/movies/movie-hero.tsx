"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/cn";

export interface MovieHeroProps {
  kicker: string;
  title: string;
  metaText: string;
  synopsis: string | null;
  art: readonly [string, string] | null;
  backdropUrl?: string | null;
  cta: ReactNode;
}

/**
 * Prominent cinematic featured-movie hero with multi-directional legibility gradients,
 * restrained glass accents, and responsive layout.
 */
export function MovieHero({
  kicker,
  title,
  metaText,
  synopsis,
  art,
  backdropUrl = null,
  cta,
}: MovieHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const style = art
    ? { backgroundImage: `linear-gradient(135deg, ${art[0]} 0%, ${art[1]} 100%)` }
    : undefined;

  const showImage = Boolean(backdropUrl) && !hasError;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate h-[22rem] overflow-hidden rounded-2xl border border-line bg-skeleton shadow-2xl sm:h-[26rem] lg:h-[32rem]"
      style={style}
    >
      {/* Loading placeholder skeleton */}
      {showImage && !isLoaded && (
        <div
          data-testid="hero-backdrop-skeleton"
          className="absolute inset-0 -z-10 animate-pulse bg-line/20"
        />
      )}

      {showImage && (
        <Image
          src={backdropUrl!}
          alt=""
          fill
          priority
          sizes="100vw"
          className={cn(
            "-z-10 object-cover object-center transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Branded atmospheric watermark on missing or failed artwork */}
      {(!showImage || hasError) && (
        <BrandMark className="absolute -end-8 -top-8 -z-10 size-72 text-on-art/10 sm:size-96 lg:size-[30rem]" />
      )}

      {/* Vertical legibility scrim gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--background)] via-[var(--scrim)]/80 to-transparent"
      />

      {/* Horizontal directional vignette to protect text in both LTR and RTL */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--background)]/85 via-[var(--background)]/35 to-transparent rtl:bg-gradient-to-l rtl:from-[var(--background)]/85 rtl:via-[var(--background)]/35 rtl:to-transparent"
      />

      <div className="flex h-full max-w-2xl flex-col justify-end gap-3.5 p-6 text-on-art sm:p-8 lg:p-12">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent shadow-sm backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            {kicker}
          </span>
        </div>

        <h1
          id="hero-title"
          className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-on-art drop-shadow-md leading-tight"
        >
          {title}
        </h1>

        {metaText ? (
          <p className="text-sm font-medium text-on-art/80 sm:text-base">{metaText}</p>
        ) : null}

        {synopsis ? (
          <p className="hidden line-clamp-3 text-sm leading-relaxed text-on-art/85 md:block sm:text-base">
            {synopsis}
          </p>
        ) : null}

        <div className="pt-2">{cta}</div>
      </div>
    </section>
  );
}
