import { Clapperboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="page-container">
      <EmptyState
        icon={<Clapperboard className="size-10" />}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/" className={buttonStyles()}>
            {t("back")}
          </Link>
        }
      />
    </div>
  );
}
