import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import {
  createServerSdkClient,
  organizationsGetById,
  serverSdkFetchNoStore,
} from "@/shared/api";
import { parseBookingSlotFromNextSearchParams } from "@/shared/lib/booking-slot-search-params";
import {
  OrganizationProfilePage,
  organizationProfileFromApiDetail,
} from "@/views/organization-profile";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const bookingSlotFromSearch = parseBookingSlotFromNextSearchParams(sp, {
    now: new Date(),
  });
  const slotNavKey = bookingSlotFromSearch
    ? `${bookingSlotFromSearch.calendarDate}-${bookingSlotFromSearch.time}`
    : "none";
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK types mark `path` as `never` for `/organizations/{id}`; runtime substitutes `{id}`.
  } as any);

  if (res.error || !res.data) {
    notFound();
  }

  return (
    <OrganizationProfilePage
      key={`${id}-${slotNavKey}`}
      profile={organizationProfileFromApiDetail(res.data)}
      bookingSlotFromSearch={bookingSlotFromSearch}
    />
  );
}
