import { Film, Sparkles } from "lucide-react";
import { PosterArt } from "@/components/movies/poster-art";
import { FIXTURE_MOVIES } from "@/features/catalog/catalog-fixtures";
import type { Movie } from "@/features/catalog/catalog-types";
import { cn } from "@/lib/cn";

export interface DiscoverHeroProps {
  title: string;
  subtitle: string;
  kicker?: string;
  movies?: readonly Movie[];
  className?: string;
}

/**
 * Editorial cinematic hero banner for the Discover catalog page.
 * Server component designed with a ~250–300px desktop height,
 * an overlapping collage of artwork from the first active movies (or fixture fallbacks),
 * full RTL logical layout support, and responsive adaptation on mobile.
 */
export function DiscoverHero({
  title,
  subtitle,
  kicker,
  movies = [],
  className,
}: DiscoverHeroProps) {
  // Extract up to 3 showcase items from the available movies, falling back to rich fixtures
  const fallbackMovies = FIXTURE_MOVIES.slice(0, 3).map((f) => ({
    id: f.id,
    title: f.title.en,
    art: f.art,
    posterUrl: f.posterUrl ?? null,
  }));

  const showcaseItems =
    movies.length > 0
      ? movies.slice(0, 3).map((m, idx) => ({
          id: m.id,
          title: m.title,
          art: m.art ?? fallbackMovies[idx % fallbackMovies.length]?.art ?? null,
          posterUrl: m.posterUrl ?? (m.art ? null : fallbackMovies[idx % fallbackMovies.length]?.posterUrl ?? null),
        }))
      : fallbackMovies;

  // Ensure we always have at least 1-3 items for the collage
  while (showcaseItems.length < 3 && fallbackMovies.length > 0) {
    const nextFallback = fallbackMovies[showcaseItems.length];
    if (nextFallback) showcaseItems.push(nextFallback);
    else break;
  }

  return (
    <section
      aria-label={title}
      data-testid="discover-hero"
      className={cn(
        "group/hero relative isolate overflow-hidden rounded-3xl border border-line/60",
        "bg-gradient-to-br from-surface via-surface/90 to-surface-raised",
        "shadow-2xl shadow-black/20",
        "min-h-[220px] sm:h-72 lg:h-[280px]",
        className,
      )}
    >
      {/* Cinematic Red Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 start-1/4 h-72 w-96 rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 end-10 h-64 w-80 rounded-full bg-accent/10 blur-2xl"
      />

      {/* Decorative Grid Mesh Texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
      />

      {/* Main Content Layout */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:flex-row sm:items-center sm:p-8 lg:p-10">
        {/* Editorial Text Block (Logical Start) */}
        <div className="max-w-xl space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wider text-accent-text shadow-sm backdrop-blur-md">
            <Film className="size-3.5" aria-hidden="true" />
            <span>{kicker ?? title}</span>
            <Sparkles className="size-3 text-accent animate-pulse" aria-hidden="true" />
          </div>

          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl lg:text-5xl leading-tight">
            {title}
          </h1>

          <p className="max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            {subtitle}
          </p>
        </div>

        {/* Cinematic Poster Collage (Logical End) */}
        <div
          aria-hidden="true"
          data-testid="discover-hero-collage"
          className="pointer-events-none relative mt-4 flex items-center justify-center sm:mt-0 sm:shrink-0 sm:ps-6 lg:ps-12"
        >
          {/* Mobile Overlay Scrim (keeps mobile text 100% crisp) */}
          <div className="absolute inset-0 z-10 block bg-gradient-to-t from-surface via-transparent to-transparent sm:hidden" />

          <div className="relative flex h-36 w-60 items-center justify-center sm:h-52 sm:w-72 lg:h-56 lg:w-80">
            {/* Card 1 (Back left / start side) */}
            {showcaseItems[0] && (
              <div
                className={cn(
                  "absolute start-2 sm:start-4 top-1/2 -translate-y-1/2",
                  "aspect-[2/3] w-20 sm:w-28 lg:w-32",
                  "rounded-xl border border-white/10 shadow-xl overflow-hidden",
                  "-rotate-6 scale-90 opacity-60 transition-transform duration-500 ease-out",
                  "group-hover/hero:-rotate-12 group-hover/hero:scale-95 group-hover/hero:opacity-75",
                )}
              >
                <PosterArt
                  art={showcaseItems[0].art}
                  posterUrl={showcaseItems[0].posterUrl}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Card 2 (Back right / end side) */}
            {showcaseItems[1] && (
              <div
                className={cn(
                  "absolute end-2 sm:end-4 top-1/2 -translate-y-1/2",
                  "aspect-[2/3] w-22 sm:w-30 lg:w-34",
                  "rounded-xl border border-white/10 shadow-xl overflow-hidden",
                  "rotate-6 scale-95 opacity-75 transition-transform duration-500 ease-out",
                  "group-hover/hero:rotate-12 group-hover/hero:scale-100 group-hover/hero:opacity-90",
                )}
              >
                <PosterArt
                  art={showcaseItems[1].art}
                  posterUrl={showcaseItems[1].posterUrl}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Card 3 (Center focal poster) */}
            {showcaseItems[2] && (
              <div
                className={cn(
                  "relative z-20",
                  "aspect-[2/3] w-24 sm:w-32 lg:w-36",
                  "rounded-xl border border-white/20 shadow-2xl shadow-black/80 overflow-hidden",
                  "-rotate-1 scale-100 transition-all duration-500 ease-out",
                  "group-hover/hero:scale-105 group-hover/hero:rotate-0 group-hover/hero:border-accent/40",
                )}
              >
                <PosterArt
                  art={showcaseItems[2].art}
                  posterUrl={showcaseItems[2].posterUrl}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
