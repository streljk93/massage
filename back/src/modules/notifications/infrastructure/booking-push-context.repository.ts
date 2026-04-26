import { Injectable } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { localeFromSavedUserProfile } from '../../../common/i18n';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type {
  BookingNotificationOrganizationSnapshot,
  BookingPushContext,
  ClientBookingReminderContext,
  BookingPushContextReader,
} from './booking-push-context.types';

export type {
  BookingPushContext,
  ClientBookingReminderContext,
  BookingPushContextReader,
};

function pickOrgDisplayName(
  org: {
    name: string;
    locales: { locale: string; name: string }[];
  } | null,
  loc: 'en' | 'ru' | 'vi',
): string {
  if (!org) {
    return '—';
  }
  const exact = org.locales.find((l) => l.locale === loc);
  if (exact) {
    return exact.name;
  }
  const en = org.locales.find((l) => l.locale === 'en');
  if (en) {
    return en.name;
  }
  return org.name;
}

function formatAddressLine(
  addressLine: string | null,
  city: string | null,
): string {
  const parts = [addressLine?.trim(), city?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function toOrgSnapshot(
  org: {
    name: string;
    addressLine: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    locales: { locale: string; name: string }[];
  } | null,
  loc: 'en' | 'ru' | 'vi',
): BookingNotificationOrganizationSnapshot | null {
  if (!org) {
    return null;
  }
  return {
    displayName: pickOrgDisplayName(org, loc),
    addressText: formatAddressLine(org.addressLine, org.city),
    latitude: org.latitude,
    longitude: org.longitude,
  };
}

const orgSelect = {
  name: true,
  addressLine: true,
  city: true,
  latitude: true,
  longitude: true,
  locales: { select: { locale: true, name: true } },
} as const;

@Injectable()
export class BookingPushContextRepository implements BookingPushContextReader {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveStatusLabel(
    status: BookingStatus,
    loc: 'en' | 'ru' | 'vi',
  ): Promise<string> {
    const row = await this.prisma.bookingStatusLocale.findUnique({
      where: { status_locale: { status, locale: loc } },
    });
    return row?.label ?? status;
  }

  async findByBookingId(bookingId: string): Promise<BookingPushContext | null> {
    const row = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        serviceNameSnapshot: true,
        startsAt: true,
        endsAt: true,
        status: true,
        cancellationComment: true,
        priceAmountSnapshot: true,
        currencySnapshot: true,
        client: { select: { name: true } },
        specialist: {
          select: {
            userId: true,
            user: { select: { email: true, name: true, locale: true } },
          },
        },
        organization: { select: orgSelect },
      },
    });
    if (!row) {
      return null;
    }
    const recipientLocale = localeFromSavedUserProfile(
      row.specialist.user.locale,
    );
    const statusLabel = await this.resolveStatusLabel(
      row.status,
      recipientLocale,
    );
    return {
      serviceNameSnapshot: row.serviceNameSnapshot,
      clientName: row.client.name,
      specialistUserId: row.specialist.userId,
      specialistEmail: row.specialist.user.email,
      specialistName: row.specialist.user.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      statusLabel,
      cancellationComment: row.cancellationComment,
      priceAmountSnapshot: row.priceAmountSnapshot,
      currencySnapshot: row.currencySnapshot,
      organization: toOrgSnapshot(row.organization, recipientLocale),
      recipientLocale,
    };
  }

  async findForClientReminder(
    bookingId: string,
  ): Promise<ClientBookingReminderContext | null> {
    const row = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: {
        serviceNameSnapshot: true,
        startsAt: true,
        endsAt: true,
        status: true,
        cancellationComment: true,
        priceAmountSnapshot: true,
        currencySnapshot: true,
        client: { select: { id: true, locale: true, email: true } },
        specialist: { select: { user: { select: { name: true } } } },
        organization: { select: orgSelect },
      },
    });
    if (!row) {
      return null;
    }
    const loc = localeFromSavedUserProfile(row.client.locale);
    const statusLabel = await this.resolveStatusLabel(row.status, loc);
    return {
      clientUserId: row.client.id,
      clientEmail: row.client.email,
      serviceName: row.serviceNameSnapshot?.trim() ?? '',
      specialistName: row.specialist.user.name,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      statusLabel,
      cancellationComment: row.cancellationComment,
      priceAmountSnapshot: row.priceAmountSnapshot,
      currencySnapshot: row.currencySnapshot,
      organization: toOrgSnapshot(row.organization, loc),
      clientLocale: row.client.locale,
    };
  }
}
