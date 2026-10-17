import Image from "next/image";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/lib/cn";

/** Decorative artwork; the movie title is rendered separately as real text. */
export function PosterArt({
  art,
  posterUrl = null,
  className,
}: {
  art: readonly [string, string] | null;
  posterUrl?: string | null;
  className?: string;
}) {
  const style = art
    ? { backgroundImage: `linear-gradient(160deg, ${art[0]} 0%, ${art[1]} 100%)` }
    : undefined;

  return (
    <div
      aria-hidden="true"
      className={cn("relative isolate overflow-hidden bg-skeleton", className)}
      style={style}
    >
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt=""
          fill
          sizes="(max-width: 639px) 44vw, (max-width: 1023px) 28vw, (max-width: 1279px) 21vw, 18vw"
          className="object-cover"
        />
      ) : (
        <BrandMark className="absolute bottom-3 end-3 size-10 text-on-art/30" />
      )}
    </div>
  );
}
