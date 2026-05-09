import { BookingEventType } from '@prisma/client';
import { z } from 'zod';

const isoDateLike = z.union([z.string().datetime({ offset: true }), z.date()]);

export const createdBookingEventPayloadSchema = z
  .object({
    startsAt: isoDateLike,
    endsAt: isoDateLike,
    pendingExpiresAt: isoDateLike.nullable().optional(),
    legacyMissingHistory: z.boolean().optional(),
  })
  .passthrough();

export const emptyBookingEventPayloadSchema = z.object({}).passthrough();

export const rejectedBookingEventPayloadSchema = z
  .object({
    rejectParty: z.enum(['client', 'specialist']),
    massOrganizationAction: z.boolean().optional(),
    reasonCode: z.string().nullable().optional(),
    reasonText: z.string().nullable().optional(),
    cancellationComment: z.string().nullable().optional(),
    devOrUnknownTransition: z.boolean().optional(),
  })
  .passthrough();

export const canceledBookingEventPayloadSchema = z
  .object({
    cancelParty: z.enum(['client', 'specialist', 'system']).optional(),
    massOrganizationAction: z.boolean().optional(),
    reasonCode: z.string().nullable().optional(),
    cancellationComment: z.string().nullable().optional(),
    reasonText: z.string().nullable().optional(),
    devOrUnknownTransition: z.boolean().optional(),
    /** Синтетический backfill/dev: строковые подсказки гранулированного статуса для проекции. */
    fromStatusHint: z.string().nullable().optional(),
    toStatusHint: z.string().nullable().optional(),
  })
  .passthrough();

export const noShowBookingEventPayloadSchema = z
  .object({
    party: z.enum(['client', 'specialist']),
    devOrUnknownTransition: z.boolean().optional(),
  })
  .passthrough();

export const expiredBookingEventPayloadSchema = z
  .object({
    reasonCode: z.string().optional(),
    reasonText: z.string().nullable().optional(),
  })
  .passthrough();

export const completedBookingEventPayloadSchema = z
  .object({
    reasonCode: z.string().nullable().optional(),
    reasonText: z.string().nullable().optional(),
  })
  .passthrough();

export const rescheduledBookingEventPayloadSchema = z
  .object({
    previousStartsAt: isoDateLike,
    previousEndsAt: isoDateLike,
    nextStartsAt: isoDateLike,
    nextEndsAt: isoDateLike,
    reasonCode: z.string().optional(),
  })
  .passthrough();

export function parseBookingEventPayload(
  type: BookingEventType,
  payload: unknown,
): unknown {
  if (payload == null || (typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload as object).length === 0)) {
    if (
      type === BookingEventType.confirmed ||
      type === BookingEventType.started ||
      type === BookingEventType.completed
    ) {
      return {};
    }
  }
  switch (type) {
    case BookingEventType.created:
      return createdBookingEventPayloadSchema.parse(payload);
    case BookingEventType.confirmed:
      return emptyBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.rejected:
      return rejectedBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.canceled:
      return canceledBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.no_show:
      return noShowBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.expired:
      return expiredBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.completed:
      return completedBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.started:
      return emptyBookingEventPayloadSchema.parse(payload ?? {});
    case BookingEventType.rescheduled:
      return rescheduledBookingEventPayloadSchema.parse(payload ?? {});
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function coerceDate(v: unknown): Date {
  if (v instanceof Date) {
    return v;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Invalid ISO date');
    }
    return d;
  }
  throw new Error('Expected date-like value');
}
