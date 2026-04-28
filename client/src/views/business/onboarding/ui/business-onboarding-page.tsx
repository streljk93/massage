import { Building2, CircleCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BusinessEmptyState } from "@/entities/business";
import { BusinessScreenHeader } from "@/widgets/business/chrome";
import { cn } from "@/shared/lib";

export async function BusinessOnboardingPage() {
  const t = await getTranslations("businessOnboarding");
  const hints = [t("hint1"), t("hint2"), t("hint3")] as const;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pt-2 pb-2">
      <BusinessScreenHeader
        title={t("title")}
        titleVariant="section"
        showHeadline={false}
        avatarAlt={t("title")}
        avatarFallback="B"
      />

      <p className="text-pretty text-[0.9375rem] leading-relaxed text-foreground/85">
        {t("welcomeLead")}
      </p>

      <BusinessEmptyState
        icon={Building2}
        title={t("emptyTitle")}
        description={t("emptyHint")}
      />

      <section
        className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-4 sm:px-5"
        aria-labelledby="business-hints-heading"
      >
        <h2
          id="business-hints-heading"
          className="font-heading text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {t("hintsTitle")}
        </h2>
        <ul className="mt-3 space-y-2.5">
          {hints.map((line) => (
            <li
              key={line}
              className="flex gap-2.5 text-pretty text-sm leading-relaxed text-muted-foreground"
            >
              <CircleCheck
                className="mt-0.5 size-4 shrink-0 text-primary/80"
                strokeWidth={2}
                aria-hidden
              />
              <span className={cn("min-w-0 flex-1")}>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
