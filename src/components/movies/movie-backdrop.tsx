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
        "relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-skeleton shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)]",
        backdropUrl ? "h-[22rem] sm:h-[28rem] lg:h-[32rem]" : "h-[14rem] sm:h-[18rem]",
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
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 55vw"
          className={cn(
            "object-cover object-center transition-opacity duration-500",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}

      {(!hasBackdrop || hasError) && (
        <BrandMark className="absolute -end-8 -top-8 -z-10 size-72 text-on-art/10 sm:size-96 lg:size-[30rem]" />
      )}

      {/* Multi-directional legibility gradients */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--background)] via-[var(--scrim)]/80 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[var(--background)]/85 via-[var(--background)]/30 to-transparent rtl:bg-gradient-to-l rtl:from-[var(--background)]/85 rtl:via-[var(--background)]/30 rtl:to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-12">
        <div>{badge}</div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-on-art drop-shadow-md sm:text-4xl lg:text-5xl leading-tight">
          {title}
        </h1>
      </div>
    </section>
  );
}
