import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  specialistsGetById,
  serverSdkFetchNoStore,
} from "@/shared/api";
import { SpecialistDetailsPage } from "@/views/specialist-profile";

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

  const res = await specialistsGetById({
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

  return (
    <SpecialistDetailsPage
      specialistId={d.id}
      name={d.name}
      bio={d.bio ?? null}
      activeWorkplace={d.activeWorkplace ?? null}
    />
  );
}
