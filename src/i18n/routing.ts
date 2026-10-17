import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fa"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];

export function resolveLocale(value: string | undefined | null): AppLocale | null {
  return (routing.locales as readonly string[]).includes(value ?? "")
    ? (value as AppLocale)
    : null;
}

export function getDirection(locale: AppLocale): "ltr" | "rtl" {
  return locale === "fa" ? "rtl" : "ltr";
}
