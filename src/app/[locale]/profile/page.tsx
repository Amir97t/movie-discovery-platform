import { Compass, House, UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/routing";

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
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </header>

      <EmptyState
        icon={<UserRound className="size-10" />}
        title={t("comingSoonTitle")}
        description={t("comingSoonDescription")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className={buttonStyles({ size: "md" })}>
              <House aria-hidden="true" className="size-4" />
              {t("backToHome")}
            </Link>
            <Link href="/discover" className={buttonStyles({ size: "md", variant: "ghost" })}>
              <Compass aria-hidden="true" className="size-4" />
              {t("goToDiscover")}
            </Link>
          </div>
        }
      />
    </div>
  );
}
