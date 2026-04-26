/**
 * Локализованные подписи статусов бронирования (`BookingStatusLocale`).
 * Локали совпадают с каталогом / UI (next-intl).
 * @typedef {'en' | 'vi' | 'ru'} SeedLocale
 */

import { SUPPORTED_CATALOG_LOCALES } from './seed-catalog-i18n.mjs';

/** @type {Record<string, Record<SeedLocale, string>>} */
const LABELS = {
  pending: {
    en: 'Pending confirmation',
    vi: 'Chờ xác nhận',
    ru: 'Ожидает подтверждения',
  },
  expired: {
    en: 'Expired',
    vi: 'Hết hạn',
    ru: 'Истекло',
  },
  reject_by_master: {
    en: 'Declined by specialist',
    vi: 'Chuyên gia từ chối',
    ru: 'Отклонено мастером',
  },
  reject_by_client: {
    en: 'Declined by client',
    vi: 'Khách hàng từ chối',
    ru: 'Отклонено клиентом',
  },
  confirmed: {
    en: 'Confirmed',
    vi: 'Đã xác nhận',
    ru: 'Подтверждено',
  },
  canceled_by_master: {
    en: 'Canceled by specialist',
    vi: 'Hủy bởi chuyên gia',
    ru: 'Отменено мастером',
  },
  canceled_by_client: {
    en: 'Canceled by client',
    vi: 'Hủy bởi khách hàng',
    ru: 'Отменено клиентом',
  },
  no_show_by_client: {
    en: 'No-show (client)',
    vi: 'Khách không đến',
    ru: 'Неявка клиента',
  },
  no_show_by_master: {
    en: 'No-show (specialist)',
    vi: 'Chuyên gia không đến',
    ru: 'Неявка мастера',
  },
  in_progress: {
    en: 'In progress',
    vi: 'Đang thực hiện',
    ru: 'В процессе',
  },
  done: {
    en: 'Completed',
    vi: 'Hoàn thành',
    ru: 'Завершено',
  },
};

const STATUSES = Object.keys(LABELS);

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
export async function seedBookingStatusLocales(prisma) {
  for (const status of STATUSES) {
    const row = LABELS[status];
    if (!row) {
      throw new Error(`[seed] booking status labels: missing ${status}`);
    }
    for (const locale of SUPPORTED_CATALOG_LOCALES) {
      const label = row[locale];
      await prisma.bookingStatusLocale.upsert({
        where: {
          status_locale: { status, locale },
        },
        create: { status, locale, label },
        update: { label },
      });
    }
  }
  console.log(
    `[seed] BookingStatusLocale: ${STATUSES.length} статусов × ${SUPPORTED_CATALOG_LOCALES.length} локалей.`,
  );
}
