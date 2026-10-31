import type { Metadata, Viewport } from "next";
import { Geist, Vazirmatn } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getDirection, resolveLocale, routing } from "@/i18n/routing";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "@/styles/globals.css";

// Build-time font loading (self-hosted by Next.js; no runtime request to
// Google). Unverified in this environment: see docs/IMPLEMENTATION_NOTES.md.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3EFEB" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  if (!locale) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "a11y" });

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      data-mode="dark"
      className={`${geist.variable} ${vazirmatn.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint to apply the saved mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background pb-[calc(4rem_+_env(safe-area-inset-bottom))] text-fg antialiased md:pb-0">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main">
            {children}
          </main>
          <SiteFooter />
          <MobileNavigation />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
