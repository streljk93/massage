# services-app

Монорепозиторий: **Next.js** (`client/`), **NestJS** (`back/`), **PostgreSQL**. Подробности по коду — в `.cursor/rules/` (архитектура, FSD, бэкенд).

## Требования

- **Node.js** 20+ (в Docker-образах используется 22)
- **npm**
- **Docker** с **Compose v2** — для полного стека одной командой

## Быстрый старт (рекомендуется)

В корне репозитория:

```bash
npm run init
```

Скрипт:

1. Устанавливает зависимости в `back/` и `client/`
2. Создаёт в корне файл **`.env`** с `JWT_SECRET` и `AUTH_SECRET` (для `docker compose`), если их ещё нет
3. При необходимости дописывает **`client/.env.local`**: `AUTH_SECRET` и `AUTH_BACKEND_URL=http://localhost:3001`
4. Поднимает стек: **`docker compose up --build -d`** (Postgres, **MinIO**, **MailHog**, `back`, `client`)
5. Ждёт готовности **PostgreSQL**, **MinIO** (S3 API) и **MailHog** (веб-интерфейс :8025), при необходимости дописывает **`back/.env`**: `S3_*` для `http://127.0.0.1:9000` и **`SMTP_*` / `MAIL_FROM`** (исходящие письма в dev с хоста бэка уходят в MailHog на `127.0.0.1:1025`, см. `back/.env.example`)
6. Применяет миграции и **сидирует каталог по умолчанию** (большая категория «Массаж» и подкатегории — см. `back/prisma/seed.mjs`)
7. Выполняет **`openapi:sync`** (экспорт OpenAPI + генерация typed SDK на клиенте; нужен доступ к БД на `localhost:5432`)

### После успешного `init`

| Сервис | URL |
|--------|-----|
| Фронт | http://localhost:3000 |
| API (Nest) | http://localhost:3001 |
| Swagger (OpenAPI UI) | http://localhost:3001/v1/docs |
| PostgreSQL | `localhost:5432` (логин/пароль/БД — в `docker-compose.yml`) |
| MinIO (файлы, S3 API) | http://localhost:9000 • консоль http://localhost:9001 (`minioadmin` / `minioadmin`) |
| **MailHog** (входящие письма в dev) | http://localhost:8025 — SMTP `127.0.0.1:1025` (или `mailhog:1025` из контейнера `back`) |

**Почта и регистрация с OTP:** в **development** бэк шлёт письма **только по SMTP** (в т.ч. в MailHog); в **production** — **только через Resend** (`RESEND_API_KEY`), SMTP для OTP тогда не используется. Реализация: `back/src/infrastructure/mail/mail.service.ts`, переменные — `back/.env.example`.

### Флаги `init`

| Флаг | Назначение |
|------|------------|
| `--deps-only` | Только `npm install` в `back` и `client` |
| `--skip-docker` | Без Docker; при заданном `DATABASE_URL` попытается `openapi:sync` |
| `--skip-openapi` | Без генерации OpenAPI SDK на клиенте |

---

## Развертывание без «полного» init

### Только секреты для Compose и подъём

```bash
npm run docker:env          # корневой .env: JWT_SECRET, AUTH_SECRET
npm run docker:up           # docker compose up --build -d
```

Или одной строкой: `npm run docker:bootstrap`.

### Только PostgreSQL (например, для локальной разработки API)

```bash
docker compose up postgres -d
```

Укажите **`DATABASE_URL`** в `back/.env` (см. `back/.env.example`) и выполните миграции и сид при необходимости: `cd back && npx prisma migrate deploy && npx prisma db seed` (каталог «Массаж» и подкатегории создаются идемпотентно).

### Пересборка типов клиента после смены API

Из корня:

```bash
npm run openapi:sync
```

(нужен запущенный Postgres и переменная `DATABASE_URL` для скрипта экспорта OpenAPI с бэка.)

---

## Почта: MailHog (dev) и Resend (production)

- **Локальная разработка и `npm run init`:** в Docker поднимается **MailHog** (см. `docker-compose.yml`). С бэка на **хосте** (`cd back && npm run start:dev`) письма с кодом подтверждения email попадают в веб-интерфейс **http://localhost:8025**, если в `back/.env` заданы `SMTP_HOST` / `SMTP_PORT` (после `init` они дописываются автоматически, если пусто). Контейнер `back` в compose смотрит на `mailhog:1025` (в коде **не-production** = только SMTP, без Resend).

- **Production:** задайте **`RESEND_API_KEY`** и корректный **`MAIL_FROM`**; при **`NODE_ENV=production`** Resend — единственный канал для OTP, переменные SMTP для этого не используются.

Детали и комментарии в **`back/.env.example`**, архитектурный смысл — в **`.cursor/rules/architecture.mdc`**.

---

## Переменные окружения

| Файл | Назначение |
|------|------------|
| **Корень `.env`** | Подхватывает Docker Compose для `${JWT_SECRET}`, `${AUTH_SECRET}`. Генерация: `npm run docker:env`. В git **не** коммитится. Шаблон: `.env.example`. |
| **`client/.env.local`** | Локальный Next (в т.ч. Auth.js `AUTH_SECRET`, `AUTH_BACKEND_URL`). Шаблон: `client/.env.example`. |
| **`back/.env`** | API Nest: `DATABASE_URL`, `JWT_SECRET`, S3, почта. Для **dev** после `init` часто появляются `S3_*` и `SMTP_*` под MinIO и MailHog; для **prod** — `RESEND_API_KEY` и `MAIL_FROM`. Подробно: `back/.env.example`. |

Секреты для сессий: из корня можно выполнить `npm run auth:secret` или `npm run auth:secret:write` (дописать в `client/.env.local`).

---

## Данные PostgreSQL в Docker

Том **`postgres_data`** сохраняет данные между перезапусками.

- `docker compose down` — контейнеры останавливаются, **данные БД сохраняются**
- `docker compose down -v` — удаляет тома → **база обнуляется**

---

## Полезные команды из корня

| Команда | Действие |
|---------|----------|
| `npm run docker:down` | Остановить Compose-без `-v` |
| `npm run docker:logs` | Логи контейнеров |
| `npm run docker:psql` | Интерактивный `psql` в postgres |
| `npm run build:all` | Сборка клиента и бэка (см. скрипты в репозитории) |

Детали по отдельным пакетам — в `client/README.md` и `back/README.md`.
