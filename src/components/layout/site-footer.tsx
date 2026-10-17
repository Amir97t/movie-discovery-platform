import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-16 border-t border-line">
      <div className="page-container py-8 text-sm text-muted">
        <p className="max-w-2xl">{t("note")}</p>
      </div>
    </footer>
  );
}
