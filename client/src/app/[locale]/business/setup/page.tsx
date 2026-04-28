import { Suspense } from "react";
import { SpecialistSetupIndexRedirect } from "@/views/business/setup/ui/specialist-setup-index-redirect";

export default function Page() {
  return (
    <main className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-lg flex-1 flex-col">
      <Suspense
        fallback={
          <div
            className="min-h-[12rem] w-full max-w-md animate-pulse rounded-2xl bg-muted/50"
            aria-hidden
          />
        }
      >
        <SpecialistSetupIndexRedirect />
      </Suspense>
    </main>
  );
}
