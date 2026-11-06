"use client";

import { AlertCircle, Bookmark, Check, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { usePersonal } from "@/features/personal/personal-context";
import type { MovieSnapshot } from "@/features/personal/personal-types";
import { cn } from "@/lib/cn";

export interface CardPersonalActionsProps {
  id: string;
  snapshot: MovieSnapshot;
  className?: string;
}

/**
 * Compact floating personal actions cluster for MovieCard posters.
 * Uses event.stopPropagation() so clicks do not navigate to the movie detail page.
 */
export function CardPersonalActions({
  id,
  snapshot,
  className,
}: CardPersonalActionsProps) {
  const t = useTranslations("personal");
  const {
    isFavorite,
    isWatchlist,
    isWatched,
    toggleFavorite,
    toggleWatchlist,
    toggleWatched,
    isReady,
    isStorageAvailable,
  } = usePersonal();

  const favorite = isReady && isFavorite(id);
  const inWatchlist = isReady && isWatchlist(id);
  const watched = isReady && isWatched(id);

  const handleFavorite = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(id, snapshot);
  };

  const handleWatchlist = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatchlist(id, snapshot);
  };

  const handleWatched = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatched(id, snapshot);
  };

  return (
    <div
      data-testid="card-personal-actions"
      title={!isStorageAvailable ? t("storageUnavailableNotice") : undefined}
      className={cn(
        "flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1 shadow-md backdrop-blur-md transition-opacity duration-200",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Favorite Button */}
      <button
        type="button"
        data-testid="card-favorite-btn"
        aria-pressed={favorite}
        aria-label={
          favorite
            ? t("removeFromFavorites", { title: snapshot.title })
            : t("addToFavorites", { title: snapshot.title })
        }
        onClick={handleFavorite}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          favorite
            ? "text-favorite fill-favorite"
            : "text-white/70 hover:text-white"
        )}
      >
        <Heart
          className={cn(
            "size-3.5 transition-colors",
            favorite ? "fill-current" : "fill-none"
          )}
        />
      </button>

      {/* Watchlist Button */}
      <button
        type="button"
        data-testid="card-watchlist-btn"
        aria-pressed={inWatchlist}
        aria-label={
          inWatchlist
            ? t("removeFromWatchlist", { title: snapshot.title })
            : t("addToWatchlist", { title: snapshot.title })
        }
        onClick={handleWatchlist}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          inWatchlist
            ? "text-accent fill-accent"
            : "text-white/70 hover:text-white"
        )}
      >
        <Bookmark
          className={cn(
            "size-3.5 transition-colors",
            inWatchlist ? "fill-current" : "fill-none"
          )}
        />
      </button>

      {/* Watched Button */}
      <button
        type="button"
        data-testid="card-watched-btn"
        aria-pressed={watched}
        aria-label={
          watched
            ? t("removeFromWatched", { title: snapshot.title })
            : t("markAsWatched", { title: snapshot.title })
        }
        onClick={handleWatched}
        className={cn(
          "flex size-7 items-center justify-center rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          watched
            ? "text-emerald-400 fill-emerald-400"
            : "text-white/70 hover:text-white"
        )}
      >
        <Check
          className={cn(
            "size-3.5 transition-colors",
            watched ? "stroke-[2.5]" : "stroke-2"
          )}
        />
      </button>
    </div>
  );
}

export interface DetailPersonalActionsProps {
  id: string;
  snapshot: MovieSnapshot;
  className?: string;
}

/**
 * Prominent action buttons for Movie Detail pages.
 */
export function DetailPersonalActions({
  id,
  snapshot,
  className,
}: DetailPersonalActionsProps) {
  const t = useTranslations("personal");
  const {
    isFavorite,
    isWatchlist,
    isWatched,
    toggleFavorite,
    toggleWatchlist,
    toggleWatched,
    isReady,
    isStorageAvailable,
  } = usePersonal();

  const favorite = isReady && isFavorite(id);
  const inWatchlist = isReady && isWatchlist(id);
  const watched = isReady && isWatched(id);

  return (
    <div
      data-testid="detail-personal-actions"
      className={cn("flex flex-wrap items-center gap-2.5 pt-1", className)}
    >
      {/* Favorite Button */}
      <button
        type="button"
        data-testid="detail-favorite-btn"
        aria-pressed={favorite}
        aria-label={
          favorite
            ? t("removeFromFavorites", { title: snapshot.title })
            : t("addToFavorites", { title: snapshot.title })
        }
        onClick={() => toggleFavorite(id, snapshot)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-sm",
          favorite
            ? "border-favorite/50 bg-favorite/20 text-favorite hover:bg-favorite/30"
            : "border-line bg-surface/80 hover:bg-surface text-fg"
        )}
      >
        <Heart
          className={cn(
            "size-4 transition-colors",
            favorite ? "fill-current" : "fill-none"
          )}
        />
        <span>{favorite ? t("inFavorites") : t("favorite")}</span>
      </button>

      {/* Watchlist Button */}
      <button
        type="button"
        data-testid="detail-watchlist-btn"
        aria-pressed={inWatchlist}
        aria-label={
          inWatchlist
            ? t("removeFromWatchlist", { title: snapshot.title })
            : t("addToWatchlist", { title: snapshot.title })
        }
        onClick={() => toggleWatchlist(id, snapshot)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-sm",
          inWatchlist
            ? "border-accent/50 bg-accent/20 text-accent-text hover:bg-accent/30"
            : "border-line bg-surface/80 hover:bg-surface text-fg"
        )}
      >
        <Bookmark
          className={cn(
            "size-4 transition-colors",
            inWatchlist ? "fill-current" : "fill-none"
          )}
        />
        <span>{inWatchlist ? t("inWatchlist") : t("watchlist")}</span>
      </button>

      {/* Watched Button */}
      <button
        type="button"
        data-testid="detail-watched-btn"
        aria-pressed={watched}
        aria-label={
          watched
            ? t("removeFromWatched", { title: snapshot.title })
            : t("markAsWatched", { title: snapshot.title })
        }
        onClick={() => toggleWatched(id, snapshot)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs sm:text-sm font-semibold transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-sm",
          watched
            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            : "border-line bg-surface/80 hover:bg-surface text-fg"
        )}
      >
        <Check
          className={cn(
            "size-4 transition-colors",
            watched ? "stroke-[2.5]" : "stroke-2"
          )}
        />
        <span>{watched ? t("markedWatched") : t("watched")}</span>
      </button>

      {!isStorageAvailable && (
        <div
          role="status"
          aria-live="polite"
          data-testid="storage-unavailable-notice"
          className="w-full flex items-center gap-1.5 pt-1 text-xs text-amber-500/90"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{t("storageUnavailableNotice")}</span>
        </div>
      )}
    </div>
  );
}
