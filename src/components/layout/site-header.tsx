import { getTranslations } from "next-intl/server";
import { AppearanceMenu } from "@/components/appearance/appearance-menu";
import { BrandMark } from "@/components/ui/brand-mark";
import { Link } from "@/i18n/navigation";
import { DesktopNav } from "./desktop-nav";

export async function SiteHeader() {
  const t = await getTranslations("a11y");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background">
      <div className="page-container flex h-14 items-center justify-between gap-4 md:h-16">
        <Link
          href="/"
          aria-label={t("brandHome")}
          className="flex min-h-11 items-center gap-2 rounded-pill text-fg"
        >
          <BrandMark className="size-7 text-accent" />
          <span className="text-lg font-bold">FRAME</span>
        </Link>
        <DesktopNav />
        <AppearanceMenu />
      </div>
    </header>
  );
}
