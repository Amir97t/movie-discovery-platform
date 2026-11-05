"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";
import { useLiquidIndicator } from "./use-liquid-indicator";

/**
 * Fixed bottom bar for < md with Apple Liquid Glass frosted layer and
 * shared liquid animated capsule active indicator.
 * Respects the bottom safe-area inset; the page <main> reserves matching space
 * so content is never hidden underneath.
 */
export function MobileNavigation() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const containerRef = useRef<HTMLUListElement>(null);
  const { isVisible, wrapperStyle, stretchClass } = useLiquidIndicator(containerRef, pathname);

  return (
    <nav
      aria-label={t("label")}
      data-mobile-nav=""
      className="liquid-glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] shadow-2xl md:hidden"
    >
      <ul ref={containerRef} className="relative grid grid-cols-4">
        {/* Liquid Active Indicator Capsule */}
        {isVisible && (
          <li
            aria-hidden="true"
            data-testid="mobile-nav-indicator"
            className="pointer-events-none absolute z-0 select-none"
            style={wrapperStyle}
          >
            <span
              className={cn(
                "block mx-2 my-1.5 h-[calc(100%-12px)] rounded-2xl border border-accent/30 bg-accent/15 shadow-[0_0_12px_rgba(229,9,20,0.18)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
                stretchClass,
              )}
            />
          </li>
        )}

        {NAV_ITEMS.map(({ key, href, icon: Icon, available }) => {
          const active = available && pathname === href;
          const itemClasses = cn(
            "relative z-10 flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs transition-colors duration-200",
            active ? "font-semibold text-accent-text" : "text-muted hover:text-fg",
          );

          return (
            <li key={key}>
              {available ? (
                <Link href={href} aria-current={active ? "page" : undefined} className={itemClasses}>
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{t(key)}</span>
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(itemClasses, "cursor-not-allowed opacity-60")}>
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
