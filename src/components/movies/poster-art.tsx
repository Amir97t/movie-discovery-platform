"use client";

import Image from "next/image";
import { useState } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/cn";

export interface PosterArtProps {
  art: readonly [string, string] | null;
  posterUrl?: string | null;
  className?: string;
}

/** Decorative artwork; the movie title is rendered separately as real text. */
export function PosterArt({
  art,
  posterUrl = null,
  className,
}: PosterArtProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const style = art
    ? { backgroundImage: `linear-gradient(160deg, ${art[0]} 0%, ${art[1]} 100%)` }
    : undefined;

  const showImage = Boolean(posterUrl) && !hasError;
  const showFallback = !posterUrl || hasError;

  return (
    <div
      aria-hidden="true"
      data-poster-status={!posterUrl ? "no-image" : hasError ? "error" : isLoaded ? "loaded" : "loading"}
      className={cn("relative isolate overflow-hidden bg-skeleton", className)}
      style={style}
    >
      {/* Loading skeleton placeholder */}
      {showImage && !isLoaded && (
        <div
          data-testid="poster-skeleton"
          className="absolute inset-0 z-10 animate-pulse bg-line/20"
        />
      )}

      {showImage && (
        <Image
          src={posterUrl!}
          alt=""
          fill
          sizes="(max-width: 639px) 44vw, (max-width: 1023px) 28vw, (max-width: 1279px) 21vw, 18vw"
          className={cn(
            "object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {/* Fallback when no image is provided or when image fails to load */}
      {showFallback && (
        <div
          data-testid="poster-fallback"
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            !art && "bg-gradient-to-br from-raised to-line/50",
          )}
        >
          <BrandMark
            className={cn(
              "size-12 transition-transform",
              art ? "text-on-art/30" : "text-muted/40",
            )}
          />
        </div>
      )}
    </div>
  );
}
