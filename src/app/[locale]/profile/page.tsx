import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProfileClient } from "@/components/personal/profile-client";
import { resolveLocale, routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale) ?? routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "profile" });
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  if (!locale) notFound();
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "profile" });

  return (
    <div className="page-container space-y-8 pt-4 sm:pt-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </header>

      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-surface/40" />}>
        <ProfileClient />
      </Suspense>
    </div>
  );
}
