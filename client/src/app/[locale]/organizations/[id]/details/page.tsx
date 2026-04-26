import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  organizationsGetById,
  serverSdkFetchNoStore,
} from "@/shared/api";
import { resolveDirectoryImageSrc } from "@/entities/organizations";
import { OrganizationDetailsPage } from "@/views/organization-profile";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  const locale = (await getLocale()) as AppLocale;
  const sdk = createServerSdkClient();

  if (!sdk) {
    notFound();
  }

  const res = await organizationsGetById({
    client: sdk,
    path: { id },
    query: { locale },
    fetch: serverSdkFetchNoStore,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK path typing
  } as any);

  if (res.error || !res.data) {
    notFound();
  }

  const d = res.data;
  const staff = (d.staff ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    imageSrc: resolveDirectoryImageSrc(s.imageUrl),
    imageAlt: s.name,
  }));

  return (
    <OrganizationDetailsPage
      organizationId={d.id}
      name={d.name}
      description={d.description ?? null}
      staff={staff}
    />
  );
}
