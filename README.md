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
6. Применяет миграции и **сидирует каталог** (категории «Массаж» / «Ногти», без демо-салонов — см. `back/prisma/seed.mjs`; демо-витрина только при `SEED_DEMO_DATA=true`)
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
| **image-moderation** (NSFW score для галереи) | Внутри Docker-сети: **http://image-moderation:8085** (`POST /v1/score`), код в `docker/nsfw-image-moderation/` |
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

Проброс портов и переменные по умолчанию — в **`docker-compose.yml`**; если Nest запущен **на хосте** без контейнеров, см. **`back/.env.example`** (`REDIS_*`, `OLLAMA_*`, `IMAGE_MODERATION_*`). По умолчанию `image-moderation` наружу не публикуется, для хостового Nest нужен override с портом `8085:8085` или внешний URL в `IMAGE_MODERATION_BASE_URL`.

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

### Production HTTPS на домене (Nginx на хосте + Docker Compose)

Рекомендуемая схема для VPS: Nginx работает **на хосте** (порт 80/443), а приложение остаётся в Docker (`client:3000`, `back:3001`) только на `127.0.0.1`.

1. Поднимите production-стек:

```bash
npm run docker:up:prod
```

2. Убедитесь, что DNS домена смотрит на IP сервера (для `bukvu.com` и `www.bukvu.com`).

3. Примените Nginx-конфиг и выпустите Let's Encrypt:

```bash
sudo npm run nginx:setup:host -- --domain bukvu.com --email admin@bukvu.com
```

Скрипт:
- установит `nginx`/`certbot` при отсутствии;
- развернёт конфиг из `deploy/nginx/services-app.conf.template`;
- выпустит сертификаты (`bukvu.com`, `www.bukvu.com`) и включит redirect на HTTPS;
- включит `certbot.timer` для автообновления сертификатов.

Если нужен только конфиг без сертификата:

```bash
sudo npm run nginx:setup:host -- --domain bukvu.com --skip-certbot
```

> Для кастомных upstream используйте `--client-upstream` и `--back-upstream`.
> По умолчанию: `http://127.0.0.1:3000` и `http://127.0.0.1:3001`.

### Только PostgreSQL (например, для локальной разработки API)

```bash
docker compose up postgres -d
```

Укажите **`DATABASE_URL`** в `back/.env` (см. `back/.env.example`) и выполните миграции и сид при необходимости: `cd back && npx prisma migrate deploy && npx prisma db seed` (каталог создаётся идемпотентно, без демо-салонов). Удалить старые демо-данные: `cd back && npm run prisma:purge-demo`. Локальная демо-витрина: `SEED_DEMO_DATA=true npx prisma db seed`.

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
| **Корень `.env` / `.env.example`** | Основной файл для `docker-compose.yml` и `docker-compose.prod.yml`: обязательный минимум (`JWT_SECRET`, `AUTH_SECRET`, `CLIENT_ORIGIN`, `AUTH_URL`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_*`) + опциональные `NEXT_PUBLIC_*`, AI/moderation и prod-ключи (`RESEND_API_KEY`, `MAIL_FROM`). |
| **`back/.env`** | Backend-специфика для Nest: `DATABASE_URL`, `ADMIN_MASTER_*`, локальные `REDIS_*`, `S3_*`, moderation, SMTP/Resend и интеграции (`FIREBASE_SERVICE_ACCOUNT_JSON`, `GOOGLE_OAUTH_CLIENT_ID`). Для host-only оверрайдов используйте `back/.env.local` (шаблон: `back/.env.local.example`). |
| **`client/.env.local`** | Локальный Next (`AUTH_SECRET`, `AUTH_URL`, `AUTH_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, OAuth/Firebase). Шаблон: `client/.env.local.example` (или `client/.env.example` как совместимый минимальный набор). |

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
