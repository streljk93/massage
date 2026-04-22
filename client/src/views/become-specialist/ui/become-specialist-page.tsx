import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import { HomeBottomNav, HomeScreenHeader } from "@/widgets/home";
import { PROSPECTIVE_SPECIALIST_EMAIL } from "../lib/onboarding-contact";
import { BecomeSpecialistLandingBody } from "./become-specialist-landing-blocks";

export async function BecomeSpecialistPage() {
  const t = await getTranslations("becomeSpecialist");
  const tSlots = await getTranslations("slots");
  const locale = (await getLocale()) as AppLocale;
  const listingNow = new Date();
  const mailtoHref = `mailto:${PROSPECTIVE_SPECIALIST_EMAIL}?subject=${encodeURIComponent(t("emailSubject"))}`;

  return (
    <div className="flex min-h-screen flex-col bg-surface-light">
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 space-y-3 px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <HomeScreenHeader
            title={t("title")}
            titleVariant="section"
            showHeadline={false}
            avatarAlt={t("title")}
            avatarFallback="SV"
          />
          <BecomeSpecialistLandingBody
            locale={locale}
            listingNow={listingNow}
            t={(key) => t(key as never)}
            tSlots={(key) => tSlots(key as never)}
            mailtoHref={mailtoHref}
            contactEmail={PROSPECTIVE_SPECIALIST_EMAIL}
          />
        </main>
      </div>

      <HomeBottomNav activeId="home" />
    </div>
  );
}
