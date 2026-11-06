"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Compass,
  Heart,
  Search,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { usePersonal } from "@/features/personal/personal-context";
import { sortLibraryMovies } from "@/features/personal/personal-storage";
import type {
  LibrarySortOption,
  LibraryTab,
  PersonalRecord,
} from "@/features/personal/personal-types";
import { cn } from "@/lib/cn";

export interface LibraryClientProps {
  initialTab?: LibraryTab;
}

export function LibraryClient({ initialTab = "favorites" }: LibraryClientProps) {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab") as LibraryTab | null;
  const activeTabDefault =
    queryTab === "watchlist" || queryTab === "watched" || queryTab === "favorites"
      ? queryTab
      : initialTab;

  const [activeTab, setActiveTab] = useState<LibraryTab>(activeTabDefault);
  const [sortBy, setSortBy] = useState<LibrarySortOption>("recently-updated");

  const t = useTranslations("library");
  const tMovie = useTranslations("movie");
  const tPersonal = useTranslations("personal");

  const { state, isStorageAvailable, isReady } = usePersonal();

  const allRecords = useMemo(() => {
    return isReady ? Object.values(state.movies) : [];
  }, [state.movies, isReady]);

  const favorites = useMemo(
    () => allRecords.filter((r) => r.isFavorite),
    [allRecords]
  );
  const watchlist = useMemo(
    () => allRecords.filter((r) => r.listStatus === "watchlist"),
    [allRecords]
  );
  const watched = useMemo(
    () => allRecords.filter((r) => r.listStatus === "watched"),
    [allRecords]
  );

  const activeRecords = useMemo(() => {
    let list: PersonalRecord[] = [];
    if (activeTab === "favorites") list = favorites;
    else if (activeTab === "watchlist") list = watchlist;
    else if (activeTab === "watched") list = watched;

    return sortLibraryMovies(list, sortBy);
  }, [activeTab, favorites, watchlist, watched, sortBy]);

  const gridItems: MovieGridItem[] = useMemo(() => {
    return activeRecords.map((r) => {
      const { snapshot } = r;
      const parts: string[] = [];
      if (snapshot.genres && snapshot.genres.length > 0) {
        parts.push(snapshot.genres.slice(0, 2).join(", "));
      }
      if (snapshot.year) {
        parts.push(String(snapshot.year));
      }
      const metaText = parts.join(" · ");
      const ratingText =
        typeof snapshot.rating === "number" ? snapshot.rating.toFixed(1) : null;
      const ratingLabel = ratingText
        ? tMovie("ratingValue", { value: ratingText })
        : tMovie("notRated");
      const notRatedLabel = tMovie("notRated");

      return {
        id: r.id,
        title: snapshot.title,
        metaText,
        ratingText,
        ratingLabel,
        notRatedLabel,
        art: snapshot.art,
        posterUrl: snapshot.posterUrl,
        href: `/movies/${r.id}`,
        year: snapshot.year,
        rating: snapshot.rating,
        genres: snapshot.genres,
      };
    });
  }, [activeRecords, tMovie]);

  const tabs: Array<{
    id: LibraryTab;
    label: string;
    icon: typeof Heart;
    count: number;
  }> = [
    {
      id: "favorites",
      label: t("tabs.favorites"),
      icon: Heart,
      count: favorites.length,
    },
    {
      id: "watchlist",
      label: t("tabs.watchlist"),
      icon: Bookmark,
      count: watchlist.length,
    },
    {
      id: "watched",
      label: t("tabs.watched"),
      icon: CheckCircle2,
      count: watched.length,
    },
  ];

  return (
    <div className="space-y-8" data-testid="library-container">
      {/* Tab controls & Sort bar */}
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Tab Navigation */}
        <div
          role="tablist"
          aria-label={t("title")}
          className="grid w-full grid-cols-3 rounded-xl border border-line bg-surface/80 p-1 sm:inline-flex sm:w-auto sm:p-1.5 shadow-sm"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                data-testid={`library-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex w-full min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto sm:min-h-0 sm:flex-row sm:gap-2 sm:px-3.5 sm:py-2",
                  isSelected
                    ? "bg-accent font-semibold text-accent-fg shadow-sm"
                    : "font-medium text-muted hover:bg-surface hover:text-fg"
                )}
              >
                <div className="flex items-center justify-center gap-1 sm:contents">
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0 sm:size-4 sm:order-1",
                      tab.id === "favorites" && isSelected && "fill-current"
                    )}
                  />
                  <span
                    data-testid={`tab-count-${tab.id}`}
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums sm:order-3 sm:text-[11px]",
                      isSelected
                        ? "bg-accent-fg/20 text-accent-fg"
                        : "bg-surface-elevated text-muted"
                    )}
                  >
                    {tab.count}
                  </span>
                </div>
                <span className="text-[11px] leading-tight text-center sm:order-2 sm:text-sm">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Controls */}
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
          <label htmlFor="library-sort" className="shrink-0 text-xs font-medium text-muted">
            {t("sortBy")}:
          </label>
          <select
            id="library-sort"
            data-testid="library-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as LibrarySortOption)}
            className="max-w-[200px] sm:max-w-none rounded-lg border border-line bg-surface/80 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent truncate"
          >
            <option value="recently-updated">{t("sort.recentlyUpdated")}</option>
            <option value="title-asc">{t("sort.titleAsc")}</option>
            <option value="year-desc">{t("sort.yearDesc")}</option>
            <option value="rating-desc">{t("sort.ratingDesc")}</option>
          </select>
        </div>
      </div>

      {/* Storage unavailable notification */}
      {!isStorageAvailable && (
        <div
          role="status"
          aria-live="polite"
          data-testid="storage-unavailable-notice"
          className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{tPersonal("storageUnavailableNotice")}</span>
        </div>
      )}

      {/* Tab Panel Content */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        data-testid={`library-panel-${activeTab}`}
      >
        {gridItems.length === 0 ? (
          <EmptyState
            icon={
              activeTab === "favorites" ? (
                <Heart className="size-8 text-favorite" />
              ) : activeTab === "watchlist" ? (
                <Bookmark className="size-8 text-accent" />
              ) : (
                <CheckCircle2 className="size-8 text-emerald-500" />
              )
            }
            title={
              activeTab === "favorites"
                ? t("emptyFavoritesTitle")
                : activeTab === "watchlist"
                ? t("emptyWatchlistTitle")
                : t("emptyWatchedTitle")
            }
            description={
              activeTab === "favorites"
                ? t("emptyFavoritesDesc")
                : activeTab === "watchlist"
                ? t("emptyWatchlistDesc")
                : t("emptyWatchedDesc")
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/discover"
                  data-testid="empty-discover-link"
                  className={buttonStyles({ size: "md" })}
                >
                  <Compass aria-hidden="true" className="size-4" />
                  <span>{t("discoverMovies")}</span>
                </Link>
                <Link
                  href="/search"
                  data-testid="empty-search-link"
                  className={buttonStyles({ size: "md", variant: "ghost" })}
                >
                  <Search aria-hidden="true" className="size-4" />
                  <span>{t("searchMovies")}</span>
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span data-testid="library-count-text">
                {t("count", { count: gridItems.length })}
              </span>
            </div>
            <MovieGrid items={gridItems} />
          </div>
        )}
      </div>
    </div>
  );
}
