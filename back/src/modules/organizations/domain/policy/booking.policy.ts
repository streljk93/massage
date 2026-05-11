import { Rules } from './organization-policy.rules';
import {
  OrganizationBookingActions,
  OrganizationCapabilities,
  deny,
  parseOrganizationSubject,
  type OrganizationCapability,
  type PolicyHandler,
} from './organization-policy.types';

export const bookingPolicy: Partial<
  Record<OrganizationCapability, PolicyHandler>
> = {
  [OrganizationCapabilities.BOOKINGS]: (ctx, subject) => {
    const booking = parseOrganizationSubject(subject, 'Booking');
    if (!booking.ok) {
      return deny(booking.reason);
    }
    if (booking.subject.action === OrganizationBookingActions.VIEW) {
      return Rules.canViewBooking(ctx, booking.subject);
    }
    if (booking.subject.action === OrganizationBookingActions.CANCEL) {
      return Rules.canCancelBooking(ctx, booking.subject);
    }
    return Rules.canManageBooking(ctx, booking.subject);
  },
};
