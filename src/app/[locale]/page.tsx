import { SearchX, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { MovieHero } from "@/components/movies/movie-hero";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getHomeCatalog } from "@/features/catalog/catalog-service";
import type { Movie } from "@/features/catalog/catalog-types";
import { resolveLocale } from "@/i18n/routing";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  if (!locale) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "home" });
  const tm = await getTranslations({ locale, namespace: "movie" });
  const tg = await getTranslations({ locale, namespace: "genres" });
  const te = await getTranslations({ locale, namespace: "states" });

  const catalog = await getHomeCatalog(locale);

  if (catalog.status !== "success") {
    const isError = catalog.status === "error";
    const source = "source" in catalog ? catalog.source : "fixture";
    return (
      <div className="page-container">
        <EmptyState
          icon={isError ? <TriangleAlert className="size-10" /> : <SearchX className="size-10" />}
          title={isError ? te("errorTitle") : te("emptyTitle")}
          description={isError ? te("errorDescription") : te(source === "api" ? "emptyDescriptionApi" : "emptyDescription")}
        />
      </div>
    );
  }

  const { featured, picks, genres } = catalog.data;
  const source = catalog.source;

  // Locale-aware number formatting (Persian digits in /fa).
  const ratingFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

  const items: MovieGridItem[] = picks.map((movie) => {
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
    };
  });

  // For API movies in Persian locale, don't show English synopsis as Persian prose.
  const featuredSynopsis = locale === "fa" && source === "api" && featured.synopsis
    ? null
    : featured.synopsis;

  return (
    <div className="page-container space-y-12 pt-4 sm:pt-6">
      <MovieHero
        kicker={t(source === "api" ? "heroKickerApi" : "heroKicker")}
        title={featured.title}
        metaText={metaFor(featured)}
        synopsis={featuredSynopsis}
        art={featured.art}
        backdropUrl={featured.backdropUrl}
        cta={
          <a href="#picks" className={buttonStyles({ size: "lg" })}>
            {t("heroCta")}
          </a>
        }
      />

      <section aria-labelledby="genres-title" className="space-y-3">
        <h2 id="genres-title" className="text-lg font-semibold text-fg">
          {t("genresTitle")}
        </h2>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {genres.map((genre) => (
            <li
              key={genre}
              className="shrink-0 rounded-pill border border-line-strong px-4 py-2 text-sm text-fg"
            >
              {tg(genre)}
            </li>
          ))}
        </ul>
      </section>

      <section id="picks" aria-labelledby="picks-title" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 id="picks-title" className="text-2xl font-bold text-fg">
            {t("picksTitle")}
          </h2>
          <p className="text-sm text-muted">{t(source === "api" ? "picksNoteApi" : "picksNote")}</p>
        </div>
        <MovieGrid items={items} />
      </section>
    </div>
  );
}
