"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { PosterArt } from "@/components/movies/poster-art";
import { cn } from "@/lib/cn";

export interface MovieBackdropProps {
  backdropUrl?: string | null;
  posterUrl?: string | null;
  art?: readonly [string, string] | null;
  title: string;
  badge: ReactNode;
  children?: ReactNode;
}

export function MovieBackdrop({
  backdropUrl,
  posterUrl,
  art,
  title,
  badge,
  children,
}: MovieBackdropProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hasBackdrop = Boolean(backdropUrl) && !hasError;
  const hasPoster = Boolean(posterUrl);

  return (
    <section
      data-testid="movie-backdrop"
      className={cn(
        "relative isolate overflow-hidden rounded-3xl border border-line shadow-2xl transition-all duration-300",
        hasBackdrop
          ? "min-h-[22rem] sm:min-h-[26rem] lg:min-h-[30rem] bg-skeleton"
          : "min-h-[16rem] sm:min-h-[18rem] lg:min-h-[20rem] bg-surface/40",
      )}
      style={
        !hasBackdrop && art
          ? {
              backgroundImage: `radial-gradient(ellipse at 50% 0%, ${art[0]}33 0%, transparent 75%)`,
            }
          : undefined
      }
    >
      {/* Loading placeholder skeleton */}
      {hasBackdrop && !isLoaded && (
        <div
          data-testid="backdrop-skeleton"
          className="absolute inset-0 -z-10 animate-pulse bg-line/20"
        />
      )}

      {/* Landscape backdrop image */}
      {hasBackdrop && (
        <Image
          src={backdropUrl!}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 55vw"
          className={cn(
            "object-cover object-center transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Atmospheric watermark when backdrop is absent */}
      {(!hasBackdrop || hasError) && (
        <BrandMark className="absolute -end-8 -top-8 -z-10 size-72 text-fg/[0.04] sm:size-96 lg:size-[30rem] pointer-events-none" />
      )}

      {/* Multi-directional legibility gradients for backdrop */}
      {hasBackdrop && (
        <>
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--background)] via-[var(--scrim)]/80 to-transparent" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--background)]/90 via-[var(--background)]/40 to-transparent rtl:bg-gradient-to-l rtl:from-[var(--background)]/90 rtl:via-[var(--background)]/40 rtl:to-transparent" />
        </>
      )}

      {/* Content layout: portrait poster + title / badge */}
      <div className="relative z-10 flex size-full flex-col justify-end p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 lg:gap-8">
          {hasPoster && (
            <div
              data-testid="movie-detail-poster"
              className={cn(
                "relative shrink-0 w-36 sm:w-44 md:w-48 lg:w-56 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1",
                hasBackdrop
                  ? "border border-white/20 ring-black/40"
                  : "border border-line-strong/30 ring-white/10",
              )}
            >
              <PosterArt art={art ?? null} posterUrl={posterUrl} className="size-full" />
            </div>
          )}

          <div className="flex-1 text-center sm:text-start rtl:sm:text-right space-y-3">
            <div>{badge}</div>
            <h1
              className={cn(
                "text-2xl font-extrabold tracking-tight drop-shadow-md sm:text-3xl md:text-4xl lg:text-5xl leading-tight",
                hasBackdrop ? "text-on-art" : "text-fg",
              )}
            >
              {title}
            </h1>
            {children && <div className="pt-2">{children}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
