import { TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getMovieByIdDirect, MovieNotFoundError } from "@/features/catalog/catalog-service";
import { resolveLocale } from "@/i18n/routing";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import Image from "next/image";
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
      <div className="page-container">
        <EmptyState
          icon={<TriangleAlert className="size-10" />}
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Link href={`/${locale}`} className={buttonStyles({ size: "md" })}>
              ← {t("backToHome")}
            </Link>
          }
        />
      </div>
    );
  }

  const hasBackdrop = movie.backdropUrl !== null;

  return (
    <div className="page-container space-y-8 pt-4 sm:pt-6">
      <nav className="flex gap-2 mb-2">
        <Link href={`/${locale}`} className={buttonStyles({ size: "md" })}>
          ← {t("backToHome")}
        </Link>
      </nav>

      <article className="space-y-6">
        <section
          className={cn(
            "relative isolate overflow-hidden rounded-card bg-skeleton",
            hasBackdrop ? "h-[20rem] sm:h-[26rem]" : "h-[12rem] sm:h-[16rem]",
          )}
        >
          {hasBackdrop && movie.backdropUrl ? (
            <Image
              src={movie.backdropUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 40vw"
              className="object-cover"
            />
          ) : null}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[var(--scrim)] via-transparent to-transparent" />
          <div className="absolute inset-0 p-6 flex flex-col justify-end">
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium text-accent-fg bg-accent">
              {t("detailPage")}
            </span>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl text-fg">
              {movie.title}
            </h1>
          </div>
        </section>

        <dl className="grid grid-cols-2 gap-4 sm:gap-6 text-sm">
          {movie.year !== null && (
            <>
              <dt className="text-muted">{t("year")}</dt>
              <dd className="text-fg">{movie.year}</dd>
            </>
          )}
          {movie.runtimeMinutes !== null && (
            <>
              <dt className="text-muted">{t("runtime")}</dt>
              <dd className="text-fg">{t("minutes", { value: movie.runtimeMinutes })}</dd>
            </>
          )}
          {movie.rating !== null && (
            <>
              <dt className="text-muted">{t("rating")}</dt>
              <dd className="text-fg">{movie.rating.toFixed(1)}</dd>
            </>
          )}
          {movie.genres.length > 0 && (
            <>
              <dt className="text-muted">{t("genres")}</dt>
              <dd className="text-fg">{movie.genres.join(", ")}</dd>
            </>
          )}
          {movie.country && (
            <>
              <dt className="text-muted">{t("country")}</dt>
              <dd className="text-fg">{movie.country}</dd>
            </>
          )}
          {movie.director && (
            <>
              <dt className="text-muted">{t("director")}</dt>
              <dd className="text-fg">{movie.director}</dd>
            </>
          )}
          {movie.actors && (
            <>
              <dt className="text-muted">{t("cast")}</dt>
              <dd className="text-fg">{movie.actors}</dd>
            </>
          )}
        </dl>

        {movie.synopsis && (
          <section className="space-y-2">
            <h3 className="text-lg font-semibold text-fg">{t("synopsis")}</h3>
            <p className="text-muted leading-relaxed">{movie.synopsis}</p>
          </section>
        )}

        {movie.imdb_id && (
          <section className="space-y-2 border-t border-line pt-6">
            <h3 className="text-lg font-semibold text-fg">{t("identifiers")}</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <dt className="text-muted">{t("imdbId")}</dt>
              <dd className="text-fg">{movie.imdb_id}</dd>
              {movie.imdb_rating !== null && (
                <>
                  <dt className="text-muted">{t("imdbRating")}</dt>
                  <dd className="text-fg">{movie.imdb_rating}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {movie.website && movie.website !== "N/A" && (
          <section className="space-y-2 border-t border-line pt-6">
            <h3 className="text-lg font-semibold text-fg">{t("website")}</h3>
            <a
              href={movie.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline"
            >
              {movie.website}
            </a>
          </section>
        )}
      </article>
    </div>
  );
}