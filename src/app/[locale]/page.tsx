import { SearchX, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { MovieGrid, type MovieGridItem } from "@/components/movies/movie-grid";
import { MovieHero } from "@/components/movies/movie-hero";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getHomeCatalog } from "@/features/catalog/catalog-service";
import { GENRE_KEYS, type Movie } from "@/features/catalog/catalog-types";
import { resolveLocale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
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
      <div className="page-container py-8">
        <EmptyState
          icon={isError ? <TriangleAlert className="size-10" /> : <SearchX className="size-10" />}
          title={isError ? te("errorTitle") : te("emptyTitle")}
          description={isError ? te("errorDescription") : te(source === "api" ? "emptyDescriptionApi" : "emptyDescription")}
        />
      </div>
    );
  }

  const { featured, picks } = catalog.data;
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
      href: `/movies/${movie.id}`,
    };
  });

  // For API movies in Persian locale, don't show English synopsis as Persian prose.
  const featuredSynopsis = locale === "fa" && source === "api" && featured.synopsis
    ? null
    : featured.synopsis;

  const chipBase =
    "inline-flex min-h-10 items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium transition-all duration-200 border border-line-strong/40 bg-surface/50 text-muted hover:border-accent/40 hover:bg-surface hover:text-fg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="page-container space-y-12 pb-16 pt-4 sm:pt-6">
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

      <section aria-labelledby="genres-title" className="space-y-4">
        <h2 id="genres-title" className="text-xl font-bold tracking-tight text-fg">
          {t("genresTitle")}
        </h2>
        <ul className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          <li key="all" className="shrink-0">
            <Link href="/discover?page=1" className={chipBase}>
              {t("allGenres")}
            </Link>
          </li>
          {GENRE_KEYS.map((genre) => (
            <li key={genre} className="shrink-0">
              <Link href={`/discover?genre=${genre}&page=1`} className={chipBase}>
                {tg(genre)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="picks" aria-labelledby="picks-title" className="scroll-mt-24 space-y-6">
        <div className="space-y-1">
          <h2 id="picks-title" className="text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
            {t("picksTitle")}
          </h2>
          <p className="text-sm text-muted">{t(source === "api" ? "picksNoteApi" : "picksNote")}</p>
        </div>
        <MovieGrid items={items} />
      </section>
    </div>
  );
}
