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
 * Presentational and locale-agnostic (all text arrives as props), so it is
 * trivially testable. Card geometry is constant: 2:3 poster, two-line title
 * block, one meta line, one rating line, regardless of missing data.
 * When `href` is provided the entire card is a link to the detail page.
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
  return (
    <article className="min-w-0">
      {href ? (
        <Link href={href} className="block">
          <PosterArt art={art} posterUrl={posterUrl} className="aspect-[2/3] w-full rounded-card" />
          <h3 className="mt-3 line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-fg">
            {title}
          </h3>
          <p className="mt-1 min-h-[1.25em] truncate text-xs text-muted">{metaText}</p>
          <p className="mt-1 flex min-h-[1.25em] items-center gap-1 text-xs text-fg">
            {ratingText ? (
              <>
                <Star aria-hidden="true" className="size-3.5 fill-current text-accent" />
                <span className="sr-only">{ratingLabel}</span>
                <span aria-hidden="true">{ratingText}</span>
              </>
            ) : (
              <span className="text-muted">{notRatedLabel}</span>
            )}
          </p>
        </Link>
      ) : (
        <>
          <PosterArt art={art} posterUrl={posterUrl} className="aspect-[2/3] w-full rounded-card" />
          <h3 className="mt-3 line-clamp-2 min-h-[2.75em] text-sm font-semibold leading-snug text-fg">
            {title}
          </h3>
          <p className="mt-1 min-h-[1.25em] truncate text-xs text-muted">{metaText}</p>
          <p className="mt-1 flex min-h-[1.25em] items-center gap-1 text-xs text-fg">
            {ratingText ? (
              <>
                <Star aria-hidden="true" className="size-3.5 fill-current text-accent" />
                <span className="sr-only">{ratingLabel}</span>
                <span aria-hidden="true">{ratingText}</span>
              </>
            ) : (
              <span className="text-muted">{notRatedLabel}</span>
            )}
          </p>
        </>
      )}
    </article>
  );
}
