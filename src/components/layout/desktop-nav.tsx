"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

export function DesktopNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ key, href, available }) => {
          const active = available && pathname === href;
          const itemClasses = cn(
            "inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-medium",
            active ? "bg-raised text-fg" : "text-muted",
          );

          return (
            <li key={key}>
              {available ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(itemClasses, "transition-colors duration-200 hover:text-fg")}
                >
                  {t(key)}
                </Link>
              ) : (
                <span aria-disabled="true" className={cn(itemClasses, "cursor-not-allowed opacity-70")}>
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
