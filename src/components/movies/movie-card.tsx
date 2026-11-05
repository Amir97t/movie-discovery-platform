import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PosterArt } from "./poster-art";
import { CardPersonalActions } from "@/components/personal/movie-actions";
import type { MovieSnapshot } from "@/features/personal/personal-types";

export interface MovieCardProps {
  id?: string;
  title: string;
  /** Pre-formatted, e.g. "Drama · 2024 · 118 min". May be empty. */
  metaText: string;
  /** Pre-formatted rating number, or null when the movie has no rating. */
  ratingText: string | null;
  /** Full accessible rating phrase, e.g. "Rating 7.8 out of 10". */
  ratingLabel: string;
  notRatedLabel: string;
  art: readonly [string, string] | null;
  posterUrl?: string | null;
  /** When provided, the card becomes a navigable link to the movie detail page. */
  href?: string;
  year?: number | null;
  rating?: number | null;
  genres?: string[];
}

/**
 * Presentational movie card with integrated personal action controls.
 * Consistent 2:3 poster geometry, refined typography, smooth hover and focus feedback.
 * Actions are rendered as sibling elements to avoid invalid nested interactive links.
 */
export function MovieCard({
  id,
  title,
  metaText,
  ratingText,
  ratingLabel,
  notRatedLabel,
  art,
  posterUrl = null,
  href,
  year = null,
  rating = null,
  genres = [],
}: MovieCardProps) {
  const snapshot: MovieSnapshot = {
    id: id ?? "",
    title,
    year,
    rating,
    posterUrl,
    art,
    genres,
  };

  return (
    <article className="group relative min-w-0">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all duration-300 group-hover:scale-[1.02] group-hover:border-accent/50 group-hover:shadow-md">
        {href ? (
          <Link
            href={href}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <PosterArt art={art} posterUrl={posterUrl} className="aspect-[2/3] w-full" />
          </Link>
        ) : (
          <PosterArt art={art} posterUrl={posterUrl} className="aspect-[2/3] w-full" />
        )}

        {id && (
          <div className="absolute top-2 end-2 z-10">
            <CardPersonalActions id={id} snapshot={snapshot} />
          </div>
        )}
      </div>

      {href ? (
        <Link
          href={href}
          className="mt-3 block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <h3 className="line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-fg transition-colors duration-200 group-hover:text-accent-text">
            {title}
          </h3>
        </Link>
      ) : (
        <h3 className="mt-3 line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-fg transition-colors duration-200 group-hover:text-accent-text">
          {title}
        </h3>
      )}

      <p className="mt-1 min-h-[1.25em] truncate text-xs text-muted">{metaText}</p>
      <p className="mt-1.5 flex min-h-[1.25em] items-center gap-1.5 text-xs text-fg">
        {ratingText ? (
          <>
            <Star aria-hidden="true" className="size-3.5 fill-current text-favorite" />
            <span className="sr-only">{ratingLabel}</span>
            <span aria-hidden="true" className="font-medium">{ratingText}</span>
          </>
        ) : (
          <span className="text-muted">{notRatedLabel}</span>
        )}
      </p>
    </article>
  );
}
