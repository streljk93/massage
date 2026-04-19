import { siteConfig } from "@/shared/config";
import { Button, Text } from "@/shared/ui";

export function HomeIntro() {
  return (
    <section className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--ds-text-primary)]">
          {siteConfig.name}
        </h1>
        <Text tone="muted">{siteConfig.description}</Text>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button">Записаться</Button>
        <Button type="button" variant="secondary">
          Для салонов
        </Button>
      </div>
    </section>
  );
}
