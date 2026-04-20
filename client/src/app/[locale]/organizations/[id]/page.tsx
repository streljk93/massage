import { notFound } from "next/navigation";
import {
  OrganizationProfilePage,
  getOrganizationProfile,
} from "@/views/organization-profile";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  const profile = getOrganizationProfile(id);
  if (!profile) {
    notFound();
  }

  return <OrganizationProfilePage profile={profile} />;
}
