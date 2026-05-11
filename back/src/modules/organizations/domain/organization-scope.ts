import {
  canAccessAllBookings,
  canAccessOwnBookings,
  type OrganizationAccessContext,
} from './policy';

export type OrganizationDataScope = {
  bookings: Record<string, unknown>;
  resources: Record<string, unknown>;
  calendarEvents: Record<string, unknown>;
};

const noRows = { AND: [{ id: null }] };

export function buildOrganizationScope(
  ctx: OrganizationAccessContext,
): OrganizationDataScope {
  if (canAccessAllBookings(ctx)) {
    return {
      bookings: {},
      resources: {},
      calendarEvents: {},
    };
  }

  if (canAccessOwnBookings(ctx)) {
    return {
      bookings: { specialistId: ctx.specialistId },
      resources: { specialistId: ctx.specialistId },
      calendarEvents: { resourceSpecialistId: ctx.specialistId },
    };
  }

  return {
    bookings: noRows,
    resources: noRows,
    calendarEvents: noRows,
  };
}

