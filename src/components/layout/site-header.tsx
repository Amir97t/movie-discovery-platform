import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppearanceMenu } from "@/components/appearance/appearance-menu";
import { BrandMark } from "@/components/ui/brand-mark";
import { Link } from "@/i18n/navigation";
import { DesktopNav } from "./desktop-nav";

export async function SiteHeader() {
  const t = await getTranslations("a11y");

  return (
    <header className="liquid-glass sticky top-0 z-30 border-b border-line transition-colors">
      <div className="page-container flex h-14 items-center justify-between gap-3 md:h-16 md:gap-4">
        <Link
          href="/"
          aria-label={t("brandHome")}
          className="flex min-h-11 items-center gap-2 rounded-pill text-fg transition-opacity hover:opacity-90"
        >
          <BrandMark className="size-7 text-accent drop-shadow-[0_0_8px_rgba(229,9,20,0.35)]" />
          <span className="text-lg font-extrabold tracking-wider">FRAME</span>
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/search"
            aria-label={t("searchMovies")}
            title={t("searchMovies")}
            data-testid="global-search-link"
            className="inline-flex size-11 items-center justify-center rounded-pill text-fg transition-colors duration-200 hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Search className="size-5" />
            <span className="sr-only">{t("searchMovies")}</span>
          </Link>
          <AppearanceMenu />
        </div>
      </div>
    </header>
  );
}
