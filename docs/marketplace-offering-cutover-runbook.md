# Marketplace offering — runbook (pre-launch, single path)

Цель: бронирование **только** по `OrganizationOffering` + `OfferingPriceOption` + назначениям `SpecialistOffering`. Legacy-якорь `Booking.serviceId` не используется.

## Порядок деплоя

1. **Миграции Prisma** (в т.ч. удаление `serviceId` у `Booking`, NOT NULL на офферных FK, очистка броней в миграции — см. `20260510140000_booking_marketplace_only_drop_service_id`).
2. При необходимости **полный сброс БД** (`prisma migrate reset`) вместо переноса старых бронь.
3. **Деплой бэкенда** с `PricingResolver`, кабинетом офферов и единым телом `POST /bookings`.
4. **Назначения мастеров на офферы** (ЛК `/business/.../offerings` или API) и при необходимости **reconcile** marketplace-рёбер / reindex listing edges.
5. **Деплой клиента** со страницей офферов и `bookingsCreate` только с `organizationOfferingId` + `offeringPriceOptionId`.
6. Проверить создание брони с гостевого профиля организации и мастера.

## Контракт API

- `POST /bookings`: обязательны `specialistId`, `startsAt`, `organizationOfferingId`, `offeringPriceOptionId`; `durationMinutes` опционально (сверка с опцией).
- Витрина: `bookableServices[]` всегда содержит `organizationOfferingId` и `marketplaceOfferingPriceOptionIds` (длины совпадают с `durationMinutes`).

## Поиск / Typesense

После массовых изменений офферов может понадобиться **полный reindex listing edges** (см. dev-инструменты / `devSearchIndexReindexListingEdges`).

## Rollback

Откат кода без отката миграций: новая схема БД уже без `serviceId` на брони — откат только на **предыдущий коммит миграций** + восстановление дампа, если нужен legacy.

## Наблюдаемость

Отказы брони логировать по кодам `BOOKING_*` / `offering` resolver; отдельный тег «legacy service» не используется.
