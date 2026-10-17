import { MovieCardSkeleton } from "@/components/movies/movie-card-skeleton";
import { MOVIE_GRID_CLASSES } from "@/components/movies/movie-grid";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-container space-y-10 pt-6">
      <Skeleton className="h-[19rem] w-full sm:h-[22rem] lg:h-[28rem]" />
      <div className={MOVIE_GRID_CLASSES}>
        {Array.from({ length: 10 }, (_, index) => (
          <MovieCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
