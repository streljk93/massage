import { UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BusinessEmptyState } from "@/entities/business";
import { BusinessScreenHeader } from "@/widgets/business/shell";

export async function BusinessProfilePage() {
  const t = await getTranslations("businessAppSubpages");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("profileTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("profileTitle")}
        avatarFallback="B"
      />

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">
        {t("profileIntro")}
      </p>

      <BusinessEmptyState
        icon={UsersRound}
        title={t("emptyProfileTitle")}
        description={t("emptyProfileHint")}
      />
    </main>
  );
}
