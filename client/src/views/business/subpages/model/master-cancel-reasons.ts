/**
 * Совпадает с `booking-master-cancel-reasons.ts` на бэкенде.
 */
export const MASTER_CANCEL_REASON_CODES = [
  "master_schedule_conflict",
  "master_unavailable_or_ill",
  "master_organization_closed",
  "master_duplicate_or_error",
  "master_other",
] as const;

export type MasterCancelReasonCode =
  (typeof MASTER_CANCEL_REASON_CODES)[number];
