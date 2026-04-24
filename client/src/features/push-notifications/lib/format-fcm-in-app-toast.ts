import type { TranslationValues } from "next-intl";

/** In-app FCM (смена статуса / напоминание): 4s, см. требования к UX. */
export const FCM_IN_APP_TOAST_MS = 4_000;

type TFn = (key: string, values?: TranslationValues) => string;

const BOOKING_STATUS_KEYS = new Set([
  "pending",
  "expired",
  "reject_by_master",
  "reject_by_client",
  "confirmed",
  "canceled_by_master",
  "canceled_by_client",
  "no_show_by_client",
  "no_show_by_master",
  "in_progress",
  "done",
]);

function isBookingStatusKey(s: string): boolean {
  return BOOKING_STATUS_KEYS.has(s);
}

/**
 * Текст из `data` FCM + локаль UI (`next-intl`). Поля `timeLabel`, `serviceName`, `specialistName`
 * шлёт бэкенд в `data` вместе с `type` / `toStatus`.
 */
export function fcmInAppToastFromData(
  t: TFn,
  data: Record<string, string> | undefined,
  fallback: { title: string; body?: string },
): { title: string; body?: string } {
  if (!data) {
    return fallback;
  }
  if (
    data.type === "booking_status" &&
    data.toStatus &&
    data.timeLabel &&
    data.serviceName !== undefined &&
    data.specialistName !== undefined &&
    isBookingStatusKey(data.toStatus)
  ) {
    const title = t(`toStatus.${data.toStatus}.title`);
    const bodyPrefix = t(`toStatus.${data.toStatus}.bodyPrefix`);
    const line = t("detailLine", {
      timeLabel: data.timeLabel,
      serviceName: data.serviceName,
      specialistName: data.specialistName,
    });
    const body = bodyPrefix ? `${bodyPrefix} — ${line}` : line;
    return { title, body };
  }
  if (
    data.type === "booking_client_reminder" &&
    data.timeLabel &&
    data.serviceName &&
    data.specialistName
  ) {
    return {
      title: t("reminder.title"),
      body: t("detailLine", {
        timeLabel: data.timeLabel,
        serviceName: data.serviceName,
        specialistName: data.specialistName,
      }),
    };
  }
  return fallback;
}
