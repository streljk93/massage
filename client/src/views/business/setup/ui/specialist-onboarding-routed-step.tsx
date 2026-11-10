"use client";

import dynamic from "next/dynamic";
import { useSpecialistOnboarding } from "./specialist-onboarding-context";

const StepIntro = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-intro"),
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
const StepSkills = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-skills"),
  { ssr: false },
);
const StepDone = dynamic(
  () => import("./setup-steps/specialist-onboarding-step-done"),
  { ssr: false },
);

const byUi = {
  1: StepIntro,
  2: StepMajors,
  3: StepProfile,
  4: StepMassage,
  5: StepWorkplace,
  6: StepSkills,
  7: StepDone,
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
