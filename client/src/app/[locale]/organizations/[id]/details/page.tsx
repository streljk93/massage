import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import { auth } from "@/auth";
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
  const session = await auth();
  const sdk = createServerSdkClient({ accessToken: session?.accessToken });

  if (!sdk) {
    notFound();
  }

  const res = await organizationsGetById({
    client: sdk,
    path: { id },
    query: { locale },
    fetch: serverSdkFetchNoStore,
  });

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
      addressLine={d.addressLine}
      city={d.city ?? null}
      phone={d.phone}
      email={d.email ?? null}
      website={d.website ?? null}
      staff={staff}
    />
  );
}
