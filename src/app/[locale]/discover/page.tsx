import { SearchX, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { GenreSidebar } from "@/components/catalog/genre-sidebar";
import { Pagination } from "@/components/catalog/pagination";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  GENRE_KEY_TO_API_NAME,
  getMoviesByGenre,
  getMoviesByPage,
  MovieNotFoundError,
} from "@/features/catalog/catalog-service";
import { GENRE_KEYS, type GenreKey, type Movie } from "@/features/catalog/catalog-types";
import { resolveLocale } from "@/i18n/routing";

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
        source: "api" | "fixture";
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
        result = await getMoviesByGenre(apiGenreName, page, locale);
      } else {
        result = await getMoviesByPage(page, locale);
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
  const ratingFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const metaFor = (movie: Movie): string => {
    const parts: string[] = [];
    const firstGenre = movie.genres[0];
    if (firstGenre) {
      try {
        parts.push(tg(firstGenre));
      } catch {
        parts.push(firstGenre);
      }
    }
    if (movie.year !== null) parts.push(plainNumber.format(movie.year));
    if (movie.runtimeMinutes !== null) {
      parts.push(tm("minutes", { value: plainNumber.format(movie.runtimeMinutes) }));
    }
    return parts.join(" · ");
  };

  const totalCount = result ? Number(result.metadata.total_count) || 0 : 0;
  const perPage = result ? Number(result.metadata.per_page) || 15 : 15;
  const totalPages = result
    ? Number(result.metadata.page_count) || Math.ceil(totalCount / perPage) || 1
    : 1;

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (selectedGenreKey) sp.set("genre", selectedGenreKey);
    sp.set("page", String(targetPage));
    return `/discover?${sp.toString()}`;
  };

  const buildGenreUrl = (genreKey?: string) => {
    if (!genreKey) return "/discover?page=1";
    return `/discover?genre=${genreKey}&page=1`;
  };

  const genreItems = GENRE_KEYS.map((key) => ({
    key,
    label: tg(key),
    href: buildGenreUrl(key),
  }));

  const items: MovieGridItem[] =
    result?.movies.map((movie) => {
      const ratingText = movie.rating === null ? null : ratingFormat.format(movie.rating);
      return {
        id: movie.id,
        title: movie.title,
        metaText: metaFor(movie),
        ratingText,
        ratingLabel: ratingText === null ? "" : tm("ratingValue", { value: ratingText }),
        notRatedLabel: tm("notRated"),
        art: movie.art,
        posterUrl: movie.posterUrl,
        href: `/movies/${movie.id}`,
      };
    }) ?? [];

  return (
    <div className="page-container space-y-8 pb-16 pt-4 sm:pt-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t("title")}</h1>
        <p className="text-base text-muted max-w-2xl">{t("subtitle")}</p>
      </section>

      {/* Catalog Layout with Desktop Sidebar and Grid */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        <GenreSidebar
          ariaLabelledBy="discover-genres-title"
          genresTitle={t("filterByGenre")}
          allLabel={t("allGenres")}
          allHref={buildGenreUrl(undefined)}
          filterButtonLabel={t("filterButton")}
          closeFiltersLabel={t("closeFilters")}
          selectedGenreKey={selectedGenreKey}
          genreItems={genreItems}
        />

        <div className="flex-1 min-w-0 w-full space-y-8">
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
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 id="discover-picks-title" className="text-2xl font-bold tracking-tight text-fg">
                    {t("moviesTitle")}
                  </h2>
                  {result?.source === "fixture" && (
                    <span
                      data-testid="fixture-fallback-notice"
                      className="inline-flex items-center text-xs font-medium text-accent-text bg-accent/10 border border-accent/20 rounded-full px-2.5 py-0.5 tracking-wide"
                    >
                      {t("fixtureNotice")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">{t("moviesNote", { count: totalCount })}</p>
              </div>

              <MovieGrid items={items} />

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                buildPageUrl={buildPageUrl}
                previousLabel={t("previous")}
                nextLabel={t("next")}
                pageInfoLabel={t("pageInfo", {
                  current: plainNumber.format(page),
                  total: plainNumber.format(totalPages),
                })}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
