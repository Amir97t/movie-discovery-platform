"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";
import { useLiquidIndicator } from "./use-liquid-indicator";

export function DesktopNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const containerRef = useRef<HTMLUListElement>(null);
  const { isVisible, wrapperStyle, stretchClass } = useLiquidIndicator(containerRef, pathname);

  return (
    <nav aria-label={t("label")} className="hidden md:block">
      <ul ref={containerRef} className="relative flex items-center gap-1.5">
        {/* Liquid Active Indicator */}
        {isVisible && (
          <li
            aria-hidden="true"
            data-testid="desktop-nav-indicator"
            className="pointer-events-none absolute z-0 select-none"
            style={wrapperStyle}
          >
            <span
              className={cn(
                "block h-full w-full rounded-pill border border-accent/30 bg-accent/15 shadow-[0_0_12px_rgba(229,9,20,0.18)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
                stretchClass,
              )}
            />
          </li>
        )}

        {NAV_ITEMS.map(({ key, href, available }) => {
          const active = available && pathname === href;
          const itemClasses = cn(
            "relative z-10 inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-medium transition-colors duration-200",
            active
              ? "font-semibold text-fg"
              : "text-muted hover:bg-raised/70 hover:text-fg",
          );

          return (
            <li key={key}>
              {available ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={itemClasses}
                >
                  {t(key)}
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(itemClasses, "cursor-not-allowed opacity-60")}>
                  {t(key)}
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
