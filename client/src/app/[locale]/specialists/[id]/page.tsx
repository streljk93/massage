import { notFound } from "next/navigation";
import {
  SpecialistProfilePage,
  getSpecialistProfile,
} from "@/views/specialist-profile";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  const profile = getSpecialistProfile(id);
  if (!profile) {
    notFound();
  }

  return <SpecialistProfilePage profile={profile} />;
}
