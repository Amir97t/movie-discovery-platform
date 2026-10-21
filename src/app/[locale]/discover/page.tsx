import { TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { GENRE_KEY_TO_API_NAME, getMoviesByGenre, getMoviesByPage, MovieNotFoundError } from "@/features/catalog/catalog-service";
import type { Movie } from "@/features/catalog/catalog-types";
import { resolveLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

function parsePage(value: string | string[] | undefined): number {
  if (!value) return 1;
  const pageStr = Array.isArray(value) ? value[0] : value;
  const page = Number(pageStr);
  return Number.isFinite(page) && page >= 1 ? page : 1;
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

  const { genre: selectedGenreKey, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const t = await getTranslations({ locale, namespace: "discover" });
  const tm = await getTranslations({ locale, namespace: "movie" });
  const tg = await getTranslations({ locale, namespace: "genres" });
  const te = await getTranslations({ locale, namespace: "states" });

  const apiGenreName = selectedGenreKey ? GENRE_KEY_TO_API_NAME[selectedGenreKey as keyof typeof GENRE_KEY_TO_API_NAME] : undefined;

  let result: { movies: Movie[]; metadata: { current_page: string; per_page: string; page_count: string; total_count: string } } | undefined;
  let error: Error | null = null;

  try {
    if (apiGenreName) {
      result = await getMoviesByGenre(apiGenreName, page);
    } else {
      result = await getMoviesByPage(page);
    }
  } catch (err) {
    if (err instanceof MovieNotFoundError) {
      notFound();
    }
    error = err as Error;
  }

  if (error) {
    return (
      <div className="page-container">
        <EmptyState
          icon={<TriangleAlert className="size-10" />}
          title={te("errorTitle")}
          description={te("errorDescription")}
          action={
            <Link href={`/${locale}/discover`} className={buttonStyles({ size: "md" })}>
              ← {t("backToHome")}
            </Link>
          }
        />
      </div>
    );
  }

  if (!result || result.movies.length === 0) {
    return (
      <div className="page-container space-y-12 pt-4 sm:pt-6">
        <section className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">{t("title")}</h1>
          <p className="text-muted">{t("noResults")}</p>
          <Link href={`/${locale}/discover`} className={cn("inline-flex items-center", "text-accent hover:underline")}>
            ← {t("backToHome")}
          </Link>
        </section>
      </div>
    );
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

  // Collect all genres present in the results for the filter chips.
  const presentGenres = new Set<string>();
  result.movies.forEach((movie) => {
    movie.genres.forEach((g) => presentGenres.add(g));
  });

  const totalCount = Number(result.metadata.total_count);
  const perPage = Number(result.metadata.per_page);
  const totalPages = Math.ceil(totalCount / perPage) || 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const items: MovieGridItem[] = result.movies.map((movie) => {
    return {
      id: movie.id,
      title: movie.title,
      metaText: metaFor(movie),
      ratingText: movie.rating === null ? null : movie.rating.toFixed(1),
      ratingLabel: movie.rating === null ? "" : tm("ratingValue", { value: movie.rating.toFixed(1) }),
      notRatedLabel: tm("notRated"),
      art: movie.art,
      posterUrl: movie.posterUrl,
      href: `/${locale}/movies/${movie.id}`,
    };
  });

  return (
    <div className="page-container space-y-12 pt-4 sm:pt-6">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-fg">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </section>

      <section aria-labelledby="discover-genres-title" className="space-y-3">
        <h2 id="discover-genres-title" className="sr-only">{t("filterByGenre")}</h2>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li
            key="all"
            className={cn(
              "shrink-0 rounded-pill px-4 py-2 text-sm",
              !selectedGenreKey
                ? "border-border bg-accent text-accent-fg"
                : "border-line-strong text-fg",
            )}
          >
            <Link href="/discover?page=1" className="flex items-center gap-1">
              {t("allGenres")}
            </Link>
          </li>
          {[...Object.entries(GENRE_KEY_TO_API_NAME)].sort(([a], [b]) => a.localeCompare(b)).map(([key]) => {
            // Only show genre chips for genres that appear in results
            if (!presentGenres.has(key)) return null;
            return (
              <li key={key} className="shrink-0 rounded-pill px-4 py-2 text-sm">
                <Link
                  href={`/discover?genre=${key}&page=1`}
                  className={cn(
                    "flex items-center gap-1",
                    selectedGenreKey === key
                      ? "border-border bg-accent text-accent-fg"
                      : "border-line-strong text-fg",
                  )}
                >
                  {tg(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="discover-picks-title" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 id="discover-picks-title" className="text-2xl font-bold text-fg">
            {t("moviesTitle")}
          </h2>
          <p className="text-sm text-muted">{t("moviesNote", { count: totalCount })}</p>
        </div>
        <MovieGrid items={items} />

        {/* Pagination */}
        <nav className="flex justify-between items-center mt-8">
          {hasPrev ? (
            <Link
              href={`/discover${selectedGenreKey ? `?genre=${selectedGenreKey}` : ""}&page=${page - 1}`}
              className={buttonStyles({ size: "md", variant: "ghost" })}
            >
              ← {t("previous")}
            </Link>
          ) : null}
          <span className="text-sm text-muted">
            {t("pageInfo", { current: page, total: totalPages })}
          </span>
          {hasNext ? (
            <Link
              href={`/discover${selectedGenreKey ? `?genre=${selectedGenreKey}` : ""}&page=${page + 1}`}
              className={buttonStyles({ size: "md", variant: "ghost" })}
            >
              {t("next")} →
            </Link>
          ) : null}
        </nav>
      </section>
    </div>
  );
}
