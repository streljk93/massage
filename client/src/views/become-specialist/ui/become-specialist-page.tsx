import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/app/i18n/navigation";
import { Button } from "@/shared/ui/button";
import { HomeBottomNav } from "@/widgets/home";
import { PROSPECTIVE_SPECIALIST_EMAIL } from "../lib/onboarding-contact";

export async function BecomeSpecialistPage() {
  const t = await getTranslations("becomeSpecialist");
  const mailtoHref = `mailto:${PROSPECTIVE_SPECIALIST_EMAIL}?subject=${encodeURIComponent("Specialist onboarding")}`;

  return (
    <div className="flex min-h-screen flex-col bg-surface-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-surface-background/95 pb-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 pt-3">
          <Button
            variant="ghost"
            className="size-11 shrink-0 rounded-full px-0"
            asChild
          >
            <Link href="/" aria-label={t("backAria")}>
              <ArrowLeft className="size-5 text-foreground" aria-hidden />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 font-heading text-lg font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("intro")}
        </p>
        <Button variant="primary" className="h-11 w-full rounded-full font-medium" asChild>
          <a href={mailtoHref}>{t("ctaEmail")}</a>
        </Button>
      </main>

      <HomeBottomNav activeId="home" />
    </div>
  );
}
