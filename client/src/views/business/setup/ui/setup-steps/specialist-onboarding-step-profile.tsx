"use client";

import { SpecialistProfileEditForm } from "@/entities/specialists";
import { useSpecialistOnboarding } from "../specialist-onboarding-context";

export default function SpecialistOnboardingStepProfile() {
  const {
    profileSaving,
    photoPreviewUrl,
    photoFileLabel,
    setPendingPhotoFile,
    pName,
    setPName,
    pGender,
    setPGender,
    pPhoneLocal,
    setPPhoneLocal,
    pBio,
    setPBio,
    pExp,
    setPExp,
    strength,
    setStrength,
    adapt,
    setAdapt,
  } = useSpecialistOnboarding();

  return (
    <SpecialistProfileEditForm
      showOnboardingIntro
      profileSaving={profileSaving}
      photoPreviewUrl={photoPreviewUrl}
      photoFileLabel={photoFileLabel}
      onPhotoFileChosen={setPendingPhotoFile}
      name={pName}
      onNameChange={setPName}
      gender={pGender}
      onGenderChange={setPGender}
      phoneLocal={pPhoneLocal}
      onPhoneLocalChange={setPPhoneLocal}
      bio={pBio}
      onBioChange={setPBio}
      experienceKey={pExp}
      onExperienceKeyChange={setPExp}
      strength={strength}
      onStrengthChange={setStrength}
      adapt={adapt}
      onAdaptChange={setAdapt}
    />
  );
}
