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
2. Создаёт в корне файл **`.env`** с `JWT_SECRET` и `AUTH_SECRET` (для `docker compose`). Секрет суперадмина дописывается в **`back/.env`** (`ADMIN_MASTER_*`); при наличии устаревших ключей в корне они переносятся в `back/.env`.
3. При необходимости дописывает **`client/.env.local`**: `AUTH_SECRET` и `AUTH_BACKEND_URL=http://localhost:3001`
4. Поднимает стек **`docker compose up --build -d`**: см. раздел ниже **«Сервисы Docker Compose»** и `docker-compose.yml`
5. Ждёт готовности ключевых контейнеров (Postgres, MinIO, MailHog, **Redis**, **Ollama**, **image-moderation**) и при необходимости дописывает **`back/.env`** (S3 под MinIO, SMTP под MailHog, Ollama/модерация картинок/Redis под BullMQ при пустых значениях — см. `scripts/init-project.mjs` и `back/.env.example`)
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
| **Ollama** (предмодерация текста UGC для Nest) | с хоста: **http://localhost:11435** (:11434 внутри образа; не конфликтует с нативным Ollama на :11434) |
| **image-moderation** (NSFW score для галереи) | HTTP **localhost:8085** (`POST /v1/score`), код в `docker/nsfw-image-moderation/` |
| **Redis** (очереди BullMQ для фон модерации) | с хоста: **localhost:6379**, том данных `redis_data`; внутри compose `back` ходит по имени **`redis`** |

### Сервисы Docker Compose (контейнеры)

Образ приложения задаёт **`docker-compose.yml`** (имя проекта Compose: `services-app`). Кратко:

| Контейнер / сервис | Назначение |
|--------------------|-----------|
| **postgres** | БД приложения (`services`), при необходимости только его: `docker compose up postgres -d`. |
| **minio** | Объектное хранилище (S3-совместимый API для файлов приложения). |
| **redis** | Брокер **BullMQ**: фон модерации профиля организации после онбординга; без него включите синхронный режим в `back`: `MODERATION_QUEUE_ENABLED=false`. |
| **ollama** | Локальная LLM для предмодерации **текста** через `OLLAMA_BASE_URL` у Nest (модель — `scripts/init-project.mjs`, entrypoint образа). |
| **image-moderation** | Отдельный HTTP-сервис для **изображений** витрины (бинарный скоринг; не смешивать API с Ollama). Собирается из `docker/nsfw-image-moderation/`. |
| **mailhog** | Перехват исходящей почты в dev (OTP и т.д.). |
| **back** | Nest API; зависит от БД, MinIO, Ollama, image-moderation, MailHog и **Redis** (последний со **healthcheck**). |
| **client** | Next.js во фронтенд-слое приложения (зависит от `back`). |

Проброс портов и переменные по умолчанию — в **`docker-compose.yml`**; если Nest запущен **на хосте** без контейнеров, см. **`back/.env.example`** (`REDIS_*`, `OLLAMA_*`, `IMAGE_MODERATION_*`).

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
npm run docker:env          # корневой .env: JWT_SECRET, AUTH_SECRET (суперадмин — `npm run init`)
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
| **Корень `.env` / `.env.example`** | Общие для compose секреты: `JWT_SECRET` (Nest) и `AUTH_SECRET` (Auth.js в Next). `npm run docker:env` пишет в корень `.env` (при первом запуске копирует структуру из `.env.example`). Файла `.env` в git нет. |
| **`client/.env.local`** | Локальный Next (`AUTH_BACKEND_URL`, `NEXT_PUBLIC_*` и т.д.). `AUTH_SECRET` дублируйте из корня или через `npm run auth:secret`. Шаблон: `client/.env.example`. |
| **`back/.env`** | Только параметры Nest: `DATABASE_URL`, S3, модерация, почта. **`JWT_SECRET`** для локального `start:dev` — тот же, что в корневом `.env` после `docker:env`; в шаблоне указано в блоке Core. Подробно: `back/.env.example`. |

Секреты для сессий: из корня можно выполнить `npm run auth:secret` или `npm run auth:secret:write` (дописать в `client/.env.local`).

---

## Данные томов Docker

- **`postgres_data`** — PostgreSQL.
- **`redis_data`** — Redis (BullMQ; ключи вида `bull:*`).
- **`minio_data`** — MinIO / объекты S3 приложения.
- **`ollama_data`** — локальное хранилище моделей Ollama (`ollama/ollama`).

- `docker compose down` — контейнеры останавливаются, **том named volumes по умолчанию сохраняются**
- `docker compose down -v` — удаляет тома → обнуляет **БД** и **persist Redis** среди подключённых volumes (осторожно)

---

## Полезные команды из корня

| Команда | Действие |
|---------|----------|
| `npm run docker:down` | Остановить Compose **без** `-v` |
| `npm run docker:logs` | Логи контейнеров |
| `npm run docker:psql` | Интерактивный `psql` в postgres |
| `npm run build:all` | Сборка клиента и бэка (см. скрипты в репозитории) |

Детали по отдельным пакетам — в `client/README.md` и `back/README.md`.
