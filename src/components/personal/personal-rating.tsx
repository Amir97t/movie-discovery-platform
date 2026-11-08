"use client";

import { AlertCircle, RotateCcw, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { usePersonal } from "@/features/personal/personal-context";
import type { MovieSnapshot } from "@/features/personal/personal-types";
import { cn } from "@/lib/cn";

export interface PersonalRatingProps {
  id: string;
  snapshot: MovieSnapshot;
  className?: string;
}

/**
 * Interactive, accessible personal rating section (0–10 in 0.5 increments).
 * Keyboard, mouse, and touch accessible; distinctly styled from API ratings.
 */
export function PersonalRatingSection({
  id,
  snapshot,
  className,
}: PersonalRatingProps) {
  const t = useTranslations("personal");
  const { getPersonalRating, setPersonalRating, clearPersonalRating, isStorageAvailable, isReady } =
    usePersonal();

  const currentRating = isReady ? getPersonalRating(id) : null;
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = hoverRating !== null ? hoverRating : currentRating;

  const handleSelectRating = (val: number) => {
    setPersonalRating(id, snapshot, val);
  };

  const handleClear = () => {
    clearPersonalRating(id);
    setHoverRating(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let nextVal = currentRating ?? 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      nextVal = Math.min(10, (currentRating ?? 0) + 0.5);
      handleSelectRating(nextVal);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      nextVal = Math.max(0, (currentRating ?? 0) - 0.5);
      handleSelectRating(nextVal);
    } else if (e.key === "Home") {
      e.preventDefault();
      handleSelectRating(0);
    } else if (e.key === "End") {
      e.preventDefault();
      handleSelectRating(10);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <section
      data-testid="personal-rating-section"
      aria-labelledby="personal-rating-heading"
      className={cn(
        "rounded-2xl border border-line bg-surface/40 p-6 sm:p-8 space-y-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3
            id="personal-rating-heading"
            className="text-base sm:text-lg font-bold tracking-tight text-fg flex items-center gap-2"
          >
            <span>{t("yourRating")}</span>
            <span className="text-xs font-normal text-muted rounded-full border border-line px-2 py-0.5 bg-surface/60">
              {t("ratePrompt")}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-muted">
            {currentRating !== null
              ? t("ratedValue", { value: currentRating.toFixed(1) })
              : t("notRated")}
          </p>
        </div>

        {currentRating !== null && (
          <button
            type="button"
            data-testid="clear-rating-btn"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-fg hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCcw className="size-3.5" />
            <span>{t("clearRating")}</span>
          </button>
        )}
      </div>

      {/* Interactive 10-Star Control with 0.5 precision slider */}
      <div
        data-testid="personal-rating-controls"
        className="space-y-3 rounded-xl p-2 -mx-2"
      >
        {/* Star row (1 to 10) */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((starVal) => {
            const isFull = displayRating !== null && displayRating >= starVal;
            const isHalf =
              displayRating !== null &&
              displayRating >= starVal - 0.5 &&
              displayRating < starVal;

            return (
              <button
                key={starVal}
                type="button"
                data-testid={`star-rating-btn-${starVal}`}
                aria-label={t("setRating", { value: starVal })}
                onMouseEnter={() => setHoverRating(starVal)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => handleSelectRating(starVal)}
                className="group relative flex size-9 sm:size-10 items-center justify-center rounded-lg transition-transform active:scale-90 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Star
                  className={cn(
                    "size-6 sm:size-7 transition-colors",
                    isFull
                      ? "fill-favorite text-favorite drop-shadow-[0_2px_8px_rgba(234,179,8,0.4)]"
                      : isHalf
                      ? "fill-favorite/50 text-favorite"
                      : "fill-none text-line-strong/60 group-hover:text-favorite/60"
                  )}
                />
                <span className="sr-only">{t("setRating", { value: starVal })}</span>
              </button>
            );
          })}
        </div>

        {/* Precision 0.5 step range input for fine-tuning */}
        <div className="flex items-center gap-3 pt-1">
          <input
            type="range"
            data-testid="rating-range-input"
            min="0"
            max="10"
            step="0.5"
            value={currentRating ?? 0}
            aria-label={t("yourRating")}
            onChange={(e) => handleSelectRating(parseFloat(e.target.value))}
            onKeyDown={handleKeyDown}
            className="w-full max-w-xs accent-favorite cursor-pointer"
          />
          <span className="text-xs font-semibold text-fg min-w-[3rem]">
            {currentRating !== null ? `${currentRating.toFixed(1)} / 10` : "0.0 / 10"}
          </span>
        </div>
      </div>

      {!isStorageAvailable && (
        <div
          role="status"
          aria-live="polite"
          data-testid="storage-unavailable-notice"
          className="flex items-center gap-1.5 pt-2 text-xs text-amber-500/90 border-t border-line/50"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{t("storageUnavailableNotice")}</span>
        </div>
      )}
    </section>
  );
}
