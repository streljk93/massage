import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  specialistsGetById,
  specialistsListReviews,
  serverSdkFetchNoStore,
} from "@/shared/api";
import { EntityReviewsPage } from "@/views/entity-reviews";

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

  const [detail, reviews] = await Promise.all([
    specialistsGetById({
      client: sdk,
      path: { id },
      query: { locale },
      fetch: serverSdkFetchNoStore,
    } as never),
    specialistsListReviews({
      client: sdk,
      path: { id },
      query: { locale, limit: 20 },
      fetch: serverSdkFetchNoStore,
    } as never),
  ]);

  if (detail.error || !detail.data) {
    notFound();
  }
  if (reviews.error || !reviews.data) {
    notFound();
  }

  return (
    <EntityReviewsPage
      kind="specialist"
      entityId={id}
      entityName={detail.data.name}
      initial={reviews.data}
    />
  );
}
