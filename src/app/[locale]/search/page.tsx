import { Compass, SearchX, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { Pagination } from "@/components/catalog/pagination";
import { SearchForm } from "@/components/search/search-form";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMoviesBySearch } from "@/features/catalog/catalog-service";
import type { Movie } from "@/features/catalog/catalog-types";
import { resolveLocale } from "@/i18n/routing";

function parsePage(value: string | string[] | undefined): number {
  if (!value) return 1;
  const pageStr = Array.isArray(value) ? value[0] : value;
  const page = parseInt(pageStr, 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  if (!locale) notFound();
  setRequestLocale(locale);

  const { q: rawQ, page: pageParam } = await searchParams;
  const trimmedQuery = typeof rawQ === "string" ? rawQ.trim().replace(/\s+/g, " ") : "";
  const page = parsePage(pageParam);

  const t = await getTranslations({ locale, namespace: "search" });
  const tm = await getTranslations({ locale, namespace: "movie" });
  const tg = await getTranslations({ locale, namespace: "genres" });

  let result:
    | {
        movies: Movie[];
        metadata: { current_page: string; per_page: string; page_count: string; total_count: string };
        source: "api" | "fixture";
      }
    | undefined;
  let fetchError: Error | null = null;

  if (trimmedQuery) {
    try {
      result = await getMoviesBySearch(trimmedQuery, page, locale);
    } catch (err) {
      fetchError = err as Error;
    }
  }

  // Locale-aware number formatting (e.g. Persian digits on /fa).
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
    if (trimmedQuery) sp.set("q", trimmedQuery);
    sp.set("page", String(targetPage));
    return `/search?${sp.toString()}`;
  };

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
      <section className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{t("title")}</h1>
          <p className="max-w-2xl text-base text-muted">{t("subtitle")}</p>
        </div>

        <SearchForm
          initialQuery={trimmedQuery}
          locale={locale}
          inputLabel={t("inputLabel")}
          inputPlaceholder={t("inputPlaceholder")}
          submitLabel={t("submit")}
        />
      </section>

      <div className="w-full space-y-8">
        {!trimmedQuery ? (
          <EmptyState
            icon={<Compass className="size-10" />}
            title={t("noQueryTitle")}
            description={t("noQueryDescription")}
          />
        ) : fetchError ? (
          <EmptyState
            icon={<TriangleAlert className="size-10" />}
            title={t("errorTitle")}
            description={t("errorDescription")}
            action={
              <Link href={buildPageUrl(1)} className={buttonStyles({ size: "md" })}>
                {t("retry")}
              </Link>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-10" />}
            title={t("noResultsTitle")}
            description={t("noResultsDescription", { query: trimmedQuery })}
          />
        ) : (
          <section aria-labelledby="search-results-title" className="scroll-mt-20 space-y-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 id="search-results-title" className="text-2xl font-bold tracking-tight text-fg">
                  {t("moviesTitle")}
                </h2>
                {result?.source === "fixture" && (
                  <span
                    data-testid="fixture-fallback-notice"
                    className="inline-flex items-center rounded-full border border-accent/20 bg-accent/10 px-2.5 py-0.5 text-xs font-medium tracking-wide text-accent-text"
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
  );
}
