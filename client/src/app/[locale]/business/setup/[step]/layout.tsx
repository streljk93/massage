"use client";

import { SpecialistOnboardingProvider } from "@/views/business/setup/ui/specialist-onboarding-context";
import { SpecialistOnboardingChrome } from "@/views/business/setup/ui/specialist-onboarding-chrome";

export default function SpecialistSetupStepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-lg flex-1 flex-col">
      <SpecialistOnboardingProvider>
        <SpecialistOnboardingChrome>{children}</SpecialistOnboardingChrome>
      </SpecialistOnboardingProvider>
    </main>
  );
}
