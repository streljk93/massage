"use client";

import { Suspense } from "react";
import { SpecialistSetupIndexRedirect } from "./specialist-setup-index-redirect";

export function SpecialistAccountSetupPage() {
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
