import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { AppLocale } from "@/app/i18n/routing";
import { auth } from "@/auth";
import {
  createServerSdkClient,
  specialistsGetById,
  serverSdkFetchNoStore,
} from "@/shared/api";
import { parseBookingSlotFromNextSearchParams } from "@/shared/lib/booking-slot-search-params";
import {
  SpecialistProfilePage,
  specialistProfileFromApiDetail,
} from "@/views/specialist-profile";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const bookingSlotFromSearch = parseBookingSlotFromNextSearchParams(sp);
  const slotNavKey = bookingSlotFromSearch
    ? `${bookingSlotFromSearch.calendarDate}-${bookingSlotFromSearch.time}`
    : "none";
  const locale = (await getLocale()) as AppLocale;
  const session = await auth();
  const sdk = createServerSdkClient({ accessToken: session?.accessToken });

  if (!sdk) {
    notFound();
  }

  const res = await specialistsGetById({
    client: sdk,
    path: { id },
    query: { locale },
    fetch: serverSdkFetchNoStore,
  });

  if (res.error || !res.data) {
    notFound();
  }

  return (
    <SpecialistProfilePage
      key={`${id}-${slotNavKey}`}
      profile={specialistProfileFromApiDetail(res.data)}
      bookingSlotFromSearch={bookingSlotFromSearch}
    />
  );
}
