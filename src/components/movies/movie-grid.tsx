import { MovieCard, type MovieCardProps } from "./movie-card";

export interface MovieGridItem extends MovieCardProps {
  id: string;
  /** Localized route to the movie detail page. */
  href: string;
}

/** 2 columns on narrow mobile, then 3 / 4 / 5 as width allows. */
export const MOVIE_GRID_CLASSES =
  "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function MovieGrid({ items }: { items: MovieGridItem[] }) {
  return (
    <ul className={MOVIE_GRID_CLASSES}>
      {items.map(({ id, href, ...card }) => (
        <li key={id} className="min-w-0">
          <MovieCard {...card} href={href} />
        </li>
      ))}
    </ul>
  );
}
