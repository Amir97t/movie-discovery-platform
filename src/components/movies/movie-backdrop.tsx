"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/cn";

export interface MovieBackdropProps {
  backdropUrl?: string | null;
  title: string;
  badge: ReactNode;
}

export function MovieBackdrop({ backdropUrl, title, badge }: MovieBackdropProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const hasBackdrop = Boolean(backdropUrl) && !hasError;

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-card bg-skeleton",
        backdropUrl ? "h-[20rem] sm:h-[26rem]" : "h-[12rem] sm:h-[16rem]",
      )}
    >
      {/* Loading placeholder skeleton */}
      {hasBackdrop && !isLoaded && (
        <div
          data-testid="backdrop-skeleton"
          className="absolute inset-0 -z-10 animate-pulse bg-line/20"
        />
      )}

      {hasBackdrop && (
        <Image
          src={backdropUrl!}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 40vw"
          className={cn(
            "object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {(!backdropUrl || hasError) && (
        <BrandMark className="absolute -end-6 -top-6 -z-10 size-64 text-on-art/10 lg:size-96" />
      )}

      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--scrim)] via-transparent to-transparent" />
      <div className="absolute inset-0 p-6 flex flex-col justify-end">
        {badge}
        <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl text-fg">
          {title}
        </h1>
      </div>
    </section>
  );
}
