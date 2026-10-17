"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

/**
 * Fixed bottom bar for < md. Respects the bottom safe-area inset; the page
 * <main> reserves matching space so content is never hidden underneath.
 */
export function MobileNavigation() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      data-mobile-nav=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ key, href, icon: Icon, available }) => {
          const active = available && pathname === href;
          const itemClasses = cn(
            "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs",
            active ? "font-semibold text-accent" : "text-muted",
          );
          const indicator = active ? (
            <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-pill bg-accent" />
          ) : null;

          return (
            <li key={key}>
              {available ? (
                <Link href={href} aria-current={active ? "page" : undefined} className={itemClasses}>
                  {indicator}
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{t(key)}</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(itemClasses, "cursor-not-allowed opacity-70")}>
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{t(key)}</span>
                  <span className="sr-only"> ({t("soon")})</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
