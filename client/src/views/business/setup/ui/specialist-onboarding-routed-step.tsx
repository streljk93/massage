"use client";

import dynamic from "next/dynamic";
import { useSpecialistOnboarding } from "./specialist-onboarding-context";

const StepIntro = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-intro"),
  { ssr: false },
);
const StepWorkPattern = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-work-pattern"),
  { ssr: false },
);
const StepMajors = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-majors"),
  { ssr: false },
);
const StepProfile = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-profile"),
  { ssr: false },
);
const StepMassage = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-massage"),
  { ssr: false },
);
const StepWorkplace = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-workplace"),
  { ssr: false },
);
const StepServices = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-services"),
  { ssr: false },
);
const StepDone = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-done"),
  { ssr: false },
);

const byUi = {
  1: StepIntro,
  2: StepWorkPattern,
  3: StepMajors,
  4: StepProfile,
  5: StepMassage,
  6: StepWorkplace,
  7: StepServices,
  8: StepDone,
} as const;

export function SpecialistOnboardingRoutedStep() {
  const { ready, activeUi } = useSpecialistOnboarding();
  if (!ready) {
    return null;
  }
  const Step = byUi[activeUi as keyof typeof byUi];
  if (!Step) {
    return null;
  }
  return <Step />;
}
