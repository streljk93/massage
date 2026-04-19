import { getTranslations } from "next-intl/server";
import { Button, Text } from "@/shared/ui";

export async function HomeIntro() {
  const t = await getTranslations();

  return (
    <section className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ds-text-primary)]">
          {t("meta.siteName")}
        </h1>
        <Text tone="muted">{t("meta.siteDescription")}</Text>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button">{t("homeIntro.book")}</Button>
        <Button type="button" variant="secondary">
          {t("homeIntro.forSalons")}
        </Button>
      </div>
    </section>
  );
}
