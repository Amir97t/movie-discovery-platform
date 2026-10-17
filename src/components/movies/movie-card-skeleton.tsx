import { Skeleton } from "@/components/ui/skeleton";

/** Same geometry as MovieCard so loading → loaded causes no layout shift. */
export function MovieCardSkeleton() {
  return (
    <div className="min-w-0">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="mt-3 h-[2.75em] w-full text-sm" />
      <Skeleton className="mt-1 h-[1.25em] w-2/3 text-xs" />
      <Skeleton className="mt-1 h-[1.25em] w-1/3 text-xs" />
    </div>
  );
}
