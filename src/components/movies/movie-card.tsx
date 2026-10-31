import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PosterArt } from "./poster-art";

export interface MovieCardProps {
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
}

/**
 * Presentational and locale-agnostic movie card.
 * Consistent 2:3 poster geometry, refined typography, smooth hover and focus feedback.
 */
export function MovieCard({
  title,
  metaText,
  ratingText,
  ratingLabel,
  notRatedLabel,
  art,
  posterUrl = null,
  href,
}: MovieCardProps) {
  const cardBody = (
    <div className="group relative block transition-transform duration-200">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all duration-300 group-hover:scale-[1.02] group-hover:border-accent/50 group-hover:shadow-md">
        <PosterArt art={art} posterUrl={posterUrl} className="aspect-[2/3] w-full" />
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-fg transition-colors duration-200 group-hover:text-accent-text">
        {title}
      </h3>
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
    </div>
  );

  return (
    <article className="min-w-0">
      {href ? (
        <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {cardBody}
        </Link>
      ) : (
        cardBody
      )}
    </article>
  );
}
