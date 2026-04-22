-- CreateTable
CREATE TABLE "BookingStatusLocale" (
    "status" "BookingStatus" NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "BookingStatusLocale_pkey" PRIMARY KEY ("status","locale")
);

-- CreateIndex
CREATE INDEX "BookingStatusLocale_locale_idx" ON "BookingStatusLocale"("locale");

-- Seed labels (en, vi, ru) — синхрон с доменными статусами `BookingStatus`.
INSERT INTO "BookingStatusLocale" ("status", "locale", "label") VALUES
('pending', 'en', 'Awaiting confirmation'),
('expired', 'en', 'Booking was not confirmed'),
('reject_by_master', 'en', 'Declined by specialist'),
('reject_by_client', 'en', 'Canceled before confirmation'),
('confirmed', 'en', 'Confirmed'),
('canceled_by_master', 'en', 'Canceled by specialist'),
('canceled_by_client', 'en', 'Canceled by you'),
('no_show_by_client', 'en', 'No-show (you did not attend)'),
('no_show_by_master', 'en', 'No-show (specialist)'),
('in_progress', 'en', 'In progress'),
('done', 'en', 'Completed'),

('pending', 'vi', 'Đang chờ xác nhận'),
('expired', 'vi', 'Lịch chưa được xác nhận'),
('reject_by_master', 'vi', 'Chuyên gia từ chối'),
('reject_by_client', 'vi', 'Bạn đã hủy trước khi xác nhận'),
('confirmed', 'vi', 'Đã xác nhận'),
('canceled_by_master', 'vi', 'Chuyên gia đã hủy'),
('canceled_by_client', 'vi', 'Bạn đã hủy'),
('no_show_by_client', 'vi', 'Không đến (phía bạn)'),
('no_show_by_master', 'vi', 'Không đến (phía chuyên gia)'),
('in_progress', 'vi', 'Đang thực hiện'),
('done', 'vi', 'Đã hoàn thành'),

('pending', 'ru', 'Ожидает подтверждения'),
('expired', 'ru', 'Запись не была подтверждена'),
('reject_by_master', 'ru', 'Отклонено специалистом'),
('reject_by_client', 'ru', 'Отменено вами до подтверждения'),
('confirmed', 'ru', 'Подтверждено'),
('canceled_by_master', 'ru', 'Отменено специалистом'),
('canceled_by_client', 'ru', 'Отменено вами'),
('no_show_by_client', 'ru', 'Неявка (клиент)'),
('no_show_by_master', 'ru', 'Неявка (специалист)'),
('in_progress', 'ru', 'Услуга выполняется'),
('done', 'ru', 'Завершено');
