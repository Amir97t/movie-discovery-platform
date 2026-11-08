import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildPageUrl: (page: number) => string;
  previousLabel: string;
  nextLabel: string;
  pageInfoLabel: string;
}

export function Pagination({
  currentPage,
  totalPages,
  buildPageUrl,
  previousLabel,
  nextLabel,
  pageInfoLabel,
}: PaginationProps) {
  // Do not render meaningless pagination when there is only 1 page or none
  if (totalPages <= 1) {
    return null;
  }

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-line pt-8"
    >
      <div>
        {hasPrev ? (
          <Link
            href={buildPageUrl(currentPage - 1)}
            className={buttonStyles({ size: "md", variant: "secondary" })}
          >
            ← {previousLabel}
          </Link>
        ) : (
          <span className="invisible" aria-hidden="true">
            <span className={buttonStyles({ size: "md", variant: "secondary" })}>
              ← {previousLabel}
            </span>
          </span>
        )}
      </div>

      <span className="text-sm font-medium text-muted">{pageInfoLabel}</span>

      <div>
        {hasNext ? (
          <Link
            href={buildPageUrl(currentPage + 1)}
            className={buttonStyles({ size: "md", variant: "secondary" })}
          >
            {nextLabel} →
          </Link>
        ) : (
          <span className="invisible" aria-hidden="true">
            <span className={buttonStyles({ size: "md", variant: "secondary" })}>
              {nextLabel} →
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}
