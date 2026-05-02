import { BusinessWorkplaceApplicantProfilePage } from "@/views/business/subpages";

type Props = {
  params: Promise<{ organizationId: string; specialistId: string }>;
};

export default async function Page({ params }: Props) {
  const { organizationId, specialistId } = await params;
  return (
    <BusinessWorkplaceApplicantProfilePage
      organizationId={organizationId}
      specialistId={specialistId}
    />
  );
}
