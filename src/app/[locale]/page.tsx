import { SearchX, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { HeroCarousel } from "@/components/movies/hero-carousel";
import { GenreSidebar } from "@/components/catalog/genre-sidebar";
import { Pagination } from "@/components/catalog/pagination";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  GENRE_KEY_TO_API_NAME,
  getHomeCatalog,
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

export default async function HomePage({
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

  const t = await getTranslations({ locale, namespace: "home" });
  const tm = await getTranslations({ locale, namespace: "movie" });
  const tg = await getTranslations({ locale, namespace: "genres" });
  const te = await getTranslations({ locale, namespace: "states" });

  // 1. Fetch stable Hero candidates
  const homeCatalog = await getHomeCatalog(locale);
  const heroCandidates =
    homeCatalog.status === "success"
      ? homeCatalog.data.heroCandidates && homeCatalog.data.heroCandidates.length > 0
        ? homeCatalog.data.heroCandidates
        : [homeCatalog.data.featured]
      : [];

  // 2. Fetch paginated catalog grid (15 items per page)
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
        result = await getMoviesByGenre(apiGenreName, page);
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

  const buildGenreUrl = (genreKey?: string) => {
    if (!genreKey) return "/";
    return `/?genre=${genreKey}&page=1`;
  };

  const genreItems = GENRE_KEYS.map((key) => ({
    key,
    label: tg(key),
    href: buildGenreUrl(key),
  }));

  const buildPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams();
    if (selectedGenreKey) sp.set("genre", selectedGenreKey);
    sp.set("page", String(targetPage));
    return `/?${sp.toString()}`;
  };

  const source = result?.source ?? (homeCatalog.status === "success" ? homeCatalog.source : "api");

  return (
    <div className="page-container space-y-12 pb-16 pt-4 sm:pt-6">
      {/* Randomized Interactive Hero Carousel */}
      {heroCandidates.length > 0 && (
        <HeroCarousel
          candidates={heroCandidates}
          kicker={t(source === "api" ? "heroKickerApi" : "heroKicker")}
          locale={locale}
        />
      )}

      {/* Main Catalog Section */}
      <section id="picks" aria-labelledby="catalog-title" className="scroll-mt-24 space-y-6">
        <div className="space-y-1">
          <h2 id="catalog-title" className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {t("picksTitle")}
          </h2>
          <p className="text-sm text-muted">
            {t(source === "api" ? "picksNoteApi" : "picksNote")}
          </p>
        </div>

        {/* Catalog Layout with Desktop Sidebar and Grid */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          <GenreSidebar
            ariaLabelledBy="catalog-genres-title"
            genresTitle={t("genresTitle")}
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
                  <Link href="/" className={buttonStyles({ size: "md" })}>
                    ← {t("allGenres")}
                  </Link>
                }
              />
            ) : isGenreUnavailable || items.length === 0 ? (
              <EmptyState
                icon={<SearchX className="size-10" />}
                title={te("emptyTitle")}
                description={t("noResults")}
                action={
                  <Link href="/" className={buttonStyles({ size: "md", variant: "secondary" })}>
                    ← {t("allGenres")}
                  </Link>
                }
              />
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
