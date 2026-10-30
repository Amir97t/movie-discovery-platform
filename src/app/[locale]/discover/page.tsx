import { SearchX, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import {
  GENRE_KEY_TO_API_NAME,
  getMoviesByGenre,
  getMoviesByPage,
  MovieNotFoundError,
} from "@/features/catalog/catalog-service";
import { GENRE_KEYS, type GenreKey, type Movie } from "@/features/catalog/catalog-types";
import { resolveLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

function parsePage(value: string | string[] | undefined): number {
  if (!value) return 1;
  const pageStr = Array.isArray(value) ? value[0] : value;
  const page = parseInt(pageStr, 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ genre?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  if (!locale) notFound();
  setRequestLocale(locale);

  const { genre: rawGenre, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const selectedGenreKey = typeof rawGenre === "string" && rawGenre.trim() ? rawGenre.trim() : undefined;
  const isKnownGenre = selectedGenreKey ? (GENRE_KEYS as readonly string[]).includes(selectedGenreKey) : false;

  const t = await getTranslations({ locale, namespace: "discover" });
  const tm = await getTranslations({ locale, namespace: "movie" });
  const tg = await getTranslations({ locale, namespace: "genres" });
  const te = await getTranslations({ locale, namespace: "states" });

  let result:
    | {
        movies: Movie[];
        metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
      }
    | undefined;
  let fetchError: Error | null = null;
  let isGenreUnavailable = false;

  if (selectedGenreKey && !isKnownGenre) {
    isGenreUnavailable = true;
  } else {
    try {
      if (selectedGenreKey && isKnownGenre) {
        const apiGenreName = GENRE_KEY_TO_API_NAME[selectedGenreKey as GenreKey];
        result = await getMoviesByGenre(apiGenreName, page);
      } else {
        result = await getMoviesByPage(page);
      }
    } catch (err) {
      if (err instanceof MovieNotFoundError) {
        isGenreUnavailable = true;
      } else {
        fetchError = err as Error;
      }
    }
  }

  // Locale-aware number formatting (Persian digits in /fa).
  const plainNumber = new Intl.NumberFormat(locale, { useGrouping: false });

  const metaFor = (movie: Movie): string => {
    const parts: string[] = [];
    const firstGenre = movie.genres[0];
    if (firstGenre) parts.push(tg(firstGenre));
    if (movie.year !== null) parts.push(plainNumber.format(movie.year));
    if (movie.runtimeMinutes !== null) {
      parts.push(tm("minutes", { value: plainNumber.format(movie.runtimeMinutes) }));
    }
    return parts.join(" · ");
  };

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (selectedGenreKey) sp.set("genre", selectedGenreKey);
    sp.set("page", String(targetPage));
    return `/discover?${sp.toString()}`;
  };

  const totalCount = result ? Number(result.metadata.total_count) : 0;
  const perPage = result ? Number(result.metadata.per_page) || 12 : 12;
  const totalPages = result
    ? Number(result.metadata.page_count) || Math.ceil(totalCount / perPage) || 1
    : 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const items: MovieGridItem[] =
    result?.movies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      metaText: metaFor(movie),
      ratingText: movie.rating === null ? null : movie.rating.toFixed(1),
      ratingLabel: movie.rating === null ? "" : tm("ratingValue", { value: movie.rating.toFixed(1) }),
      notRatedLabel: tm("notRated"),
      art: movie.art,
      posterUrl: movie.posterUrl,
      href: `/movies/${movie.id}`,
    })) ?? [];

  const chipBase =
    "inline-flex min-h-10 items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="page-container space-y-10 pb-16 pt-4 sm:pt-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t("title")}</h1>
        <p className="text-base text-muted max-w-2xl">{t("subtitle")}</p>
      </section>

      {/* Stable Genre Chips Bar */}
      <section aria-labelledby="discover-genres-title" className="space-y-4">
        <h2 id="discover-genres-title" className="sr-only">
          {t("filterByGenre")}
        </h2>
        <ul className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          <li key="all" className="shrink-0">
            <Link
              href="/discover?page=1"
              className={cn(
                chipBase,
                !selectedGenreKey
                  ? "bg-accent text-accent-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.3)]"
                  : "border border-line-strong/40 bg-surface/50 text-muted hover:border-accent/40 hover:bg-surface hover:text-fg",
              )}
            >
              {t("allGenres")}
            </Link>
          </li>
          {GENRE_KEYS.map((key) => {
            const isSelected = selectedGenreKey === key;
            return (
              <li key={key} className="shrink-0">
                <Link
                  href={`/discover?genre=${key}&page=1`}
                  className={cn(
                    chipBase,
                    isSelected
                      ? "bg-accent text-accent-fg font-semibold shadow-[0_2px_12px_rgba(229,9,20,0.3)]"
                      : "border border-line-strong/40 bg-surface/50 text-muted hover:border-accent/40 hover:bg-surface hover:text-fg",
                  )}
                >
                  {tg(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Content Area */}
      {fetchError ? (
        <EmptyState
          icon={<TriangleAlert className="size-10" />}
          title={te("errorTitle")}
          description={te("errorDescription")}
          action={
            <Link href="/discover?page=1" className={buttonStyles({ size: "md" })}>
              ← {t("backToHome")}
            </Link>
          }
        />
      ) : isGenreUnavailable || items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-10" />}
          title={te("emptyTitle")}
          description={t("noResults")}
          action={
            <Link href="/discover?page=1" className={buttonStyles({ size: "md", variant: "secondary" })}>
              ← {t("allGenres")}
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="discover-picks-title" className="scroll-mt-20 space-y-6">
          <div className="space-y-1">
            <h2 id="discover-picks-title" className="text-2xl font-bold tracking-tight text-fg">
              {t("moviesTitle")}
            </h2>
            <p className="text-sm text-muted">{t("moviesNote", { count: totalCount })}</p>
          </div>
          <MovieGrid items={items} />

          {/* Pagination */}
          <nav aria-label="Pagination" className="flex justify-between items-center pt-8 border-t border-white/[0.08]">
            {hasPrev ? (
              <Link
                href={buildPageUrl(page - 1)}
                className={buttonStyles({ size: "md", variant: "secondary" })}
              >
                ← {t("previous")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-medium text-muted">
              {t("pageInfo", { current: page, total: totalPages })}
            </span>
            {hasNext ? (
              <Link
                href={buildPageUrl(page + 1)}
                className={buttonStyles({ size: "md", variant: "secondary" })}
              >
                {t("next")} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </section>
      )}
    </div>
  );
}
