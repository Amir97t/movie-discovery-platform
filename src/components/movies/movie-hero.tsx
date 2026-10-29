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
 * Fixed heights per breakpoint reserve space before any content paints, so
 * the hero cannot shift layout. Text sits on a fixed dark scrim so contrast
 * does not depend on the active theme or the artwork.
 */
export function MovieHero({ kicker, title, metaText, synopsis, art, backdropUrl = null, cta }: MovieHeroProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const style = art
    ? { backgroundImage: `linear-gradient(135deg, ${art[0]} 0%, ${art[1]} 100%)` }
    : undefined;

  const showImage = Boolean(backdropUrl) && !hasError;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate h-[19rem] overflow-hidden rounded-card bg-skeleton sm:h-[22rem] lg:h-[28rem]"
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
            "-z-10 object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
      <BrandMark className="absolute -end-6 -top-6 -z-10 size-64 text-on-art/10 lg:size-96" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--scrim)] to-transparent"
      />
      <div className="flex h-full max-w-2xl flex-col justify-end gap-3 p-5 text-on-art sm:p-8 lg:p-10">
        <p className="text-xs font-semibold">{kicker}</p>
        <h1 id="hero-title" className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {metaText ? <p className="text-sm">{metaText}</p> : null}
        {synopsis ? <p className="hidden line-clamp-2 text-base md:block">{synopsis}</p> : null}
        <div className="pt-1">{cta}</div>
      </div>
    </section>
  );
}
