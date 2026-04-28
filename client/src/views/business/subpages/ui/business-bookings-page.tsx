import { Inbox } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BusinessEmptyState } from "@/entities/business";
import { BusinessScreenHeader } from "@/widgets/business/chrome";

export async function BusinessBookingsPage() {
  const t = await getTranslations("businessAppSubpages");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("bookingsTitle")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("bookingsTitle")}
        avatarFallback="B"
      />

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">
        {t("bookingsIntro")}
      </p>

      <BusinessEmptyState
        icon={Inbox}
        title={t("emptyBookingsTitle")}
        description={t("emptyBookingsHint")}
      />
    </main>
  );
}
