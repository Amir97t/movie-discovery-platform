import { Star, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getMovieByIdDirect, MovieNotFoundError } from "@/features/catalog/catalog-service";
import { resolveLocale } from "@/i18n/routing";
import { buttonStyles } from "@/components/ui/button";
import { MovieBackdrop } from "@/components/movies/movie-backdrop";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: rawLocale, id } = await params;
  const locale = resolveLocale(rawLocale);
  if (!locale) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "movie" });

  let movie;
  try {
    movie = await getMovieByIdDirect(id);
  } catch (error) {
    if (error instanceof MovieNotFoundError) {
      notFound();
    }
    // Network errors, timeouts, 5xx, malformed responses — show error state, not not-found
    return (
      <div className="page-container py-8">
        <EmptyState
          icon={<TriangleAlert className="size-10" />}
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Link href="/" className={buttonStyles({ size: "md" })}>
              ← {t("backToHome")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-container space-y-8 pb-16 pt-4 sm:pt-6">
      <nav className="flex items-center gap-2">
        <Link href="/" className={buttonStyles({ size: "md", variant: "secondary" })}>
          ← {t("backToHome")}
        </Link>
      </nav>

      <article className="space-y-8">
        <MovieBackdrop
          backdropUrl={movie.backdropUrl}
          title={movie.title}
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/20 px-3.5 py-1 text-xs font-semibold text-accent-text shadow-sm backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              {t("detailPage")}
            </span>
          }
        />

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {movie.rating !== null && (
            <div className="rounded-xl border border-line bg-surface/50 p-4 shadow-sm">
              <dt className="text-xs font-medium text-muted">{t("rating")}</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold text-fg">
                <Star aria-hidden="true" className="size-4 fill-current text-favorite" />
                <span>{movie.rating.toFixed(1)}</span>
                <span className="text-xs font-normal text-muted">/ 10</span>
              </dd>
            </div>
          )}
          {movie.year !== null && (
            <div className="rounded-xl border border-line bg-surface/50 p-4 shadow-sm">
              <dt className="text-xs font-medium text-muted">{t("year")}</dt>
              <dd className="mt-1 text-lg font-bold text-fg">{movie.year}</dd>
            </div>
          )}
          {movie.runtimeMinutes !== null && (
            <div className="rounded-xl border border-line bg-surface/50 p-4 shadow-sm">
              <dt className="text-xs font-medium text-muted">{t("runtime")}</dt>
              <dd className="mt-1 text-lg font-bold text-fg">
                {t("minutes", { value: movie.runtimeMinutes })}
              </dd>
            </div>
          )}
          {movie.country && (
            <div className="rounded-xl border border-line bg-surface/50 p-4 shadow-sm">
              <dt className="text-xs font-medium text-muted">{t("country")}</dt>
              <dd className="mt-1 truncate text-lg font-bold text-fg">{movie.country}</dd>
            </div>
          )}
        </div>

        {/* Detailed Metadata Grid */}
        <dl className="grid grid-cols-1 gap-6 rounded-2xl border border-line bg-surface/40 p-6 sm:grid-cols-2 sm:p-8">
          {movie.genres.length > 0 && (
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t("genres")}</dt>
              <dd className="flex flex-wrap gap-1.5 pt-1 text-sm text-fg">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center rounded-pill border border-line-strong/40 bg-surface/80 px-2.5 py-0.5 text-xs text-fg"
                  >
                    {g}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {movie.director && (
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t("director")}</dt>
              <dd className="text-sm font-medium text-fg">{movie.director}</dd>
            </div>
          )}
          {movie.actors && (
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t("cast")}</dt>
              <dd className="text-sm leading-relaxed text-fg">{movie.actors}</dd>
            </div>
          )}
        </dl>

        {movie.synopsis && (
          <section className="space-y-3 rounded-2xl border border-line bg-surface/30 p-6 sm:p-8">
            <h3 className="text-lg font-bold tracking-tight text-fg">{t("synopsis")}</h3>
            <p className="max-w-3xl text-base leading-relaxed text-muted">{movie.synopsis}</p>
          </section>
        )}

        {movie.imdb_id && (
          <section className="space-y-3 border-t border-line pt-6">
            <h3 className="text-lg font-bold tracking-tight text-fg">{t("identifiers")}</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:max-w-md">
              <div>
                <dt className="text-xs font-medium text-muted">{t("imdbId")}</dt>
                <dd className="mt-0.5 font-mono text-sm text-fg">{movie.imdb_id}</dd>
              </div>
              {movie.imdb_rating !== null && (
                <div>
                  <dt className="text-xs font-medium text-muted">{t("imdbRating")}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-fg">{movie.imdb_rating}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {movie.website && movie.website !== "N/A" && (
          <section className="space-y-2 border-t border-line pt-6">
            <h3 className="text-lg font-bold tracking-tight text-fg">{t("website")}</h3>
            <a
              href={movie.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {movie.website}
            </a>
          </section>
        )}
      </article>
    </div>
  );
}
