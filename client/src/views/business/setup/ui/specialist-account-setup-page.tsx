import { SpecialistOnboardingWizard } from "./specialist-onboarding-wizard";

export async function SpecialistAccountSetupPage() {
  return (
    <main className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-lg flex-1 flex-col">
      <SpecialistOnboardingWizard />
    </main>
  );
}
