# ADR — маркетплейс: offerings, поиск, проекции, SoT

Канонический архитектурный документ для эволюции каталога точки (`OrganizationOffering`), поиска и бронирований. Код и Prisma догоняют этот текст по **Phase A → B** без нарушения инвариантов.

## Контекст

- Текущая строка **`Service`** перегружена (скоуп org/personal, FK мастера/организации, коммерция, витрина directory). Целевой **стабильный hit** листинга — **`OrganizationOffering.id`**.
- **PostgreSQL (OLTP приложения)** остаётся **primary SoT**; внешний поисковый индекс и теневые проекции — **disposable**.

## Владение данными (§3.0.2)

| Сущность | Канон |
|----------|--------|
| Коммерция оффера точки (title, slug, publication, list price по опциям) | **`OrganizationOffering` + `OfferingPriceOption`** |
| Кто **исполняет** оффер и overrides цены по опции | **`SpecialistOffering` + `SpecialistOfferingPriceOverride`** |
| Effective unit price для UI/брони/отчётов | **Только производная через `PricingResolver`** — **не** хранить canonical `effectivePrice` колонкой в OLTP |

## Aggregate roots и кросс-агрегат

- Изменять **`OrganizationOffering` / опции / привязки мастера** только через сценарии своего контекста; согласованность с поиском/бронированием — **domain services**, не прямые «чужие» апдейты в обход правил.

## Проекции и транзакции (§3.0.3–§3.0.6)

- **`SearchEngine`** и материализованные документы — **eventually consistent**. Не выполнять HTTP upsert индекса внутри той же DB-транзакции, что мутирует каталог.

## Идемпотентность и версии документа (§3.0.7)

Разделять два понятия:

1. **`SearchDocument.schemaVersion`** (в payload JSON индекса) — контракт **полей документа** для читателей listing API; совместимое расширение vs bump major + phased dual-read.
2. **`projectionBuildVersion` / indexer checkpoint** — **операционный** счётчик полного rebuild / смены builder; живёт во внутреннем состоянии воркера / таблице (`SearchDocumentProjection` в Postgres как опциональная shadow-копия), **не смешивать семантику** со `schemaVersion` без записи в runbook.

## Публикация оффера (§3.2.7)

- **`firstPublishedAt`** — первый переход оффера в продаваемое состояние; **не сбрасывается** («новые офферы», исторический якорь, trust).
- **`lastPublishedAt`** — каждый последующий go-live после `hidden`/`archived`/модерации и т.д. (freshness, «обновилось», date modified в UX).
- **Slug** после первого **`published`** — **immutable** (реком.) — см. секцию SEO ниже.

## Lifecycle `OfferingPriceOption` (§3.2.8, must-have)

- **`OfferingPriceOptionStatus` + `deletedAt`** обязательны до Phase B cutover бронирования на новые FK: сохранять **`offeringPriceOptionId`** в истории, аналитике, объявлениях.

## Специалист × оффер (§3.2.3–§3.2.4)

- На **`SpecialistOffering`** не дублировать канонический title/list price оффера; только execution + overrides per option.
- **`SpecialistOfferingPriceOverride.customPrice`**: `Int` обязателен (не `Int?`).

## Ранжирование (§3.2.5)

- **Движок** = **retrieval** (фильтры, geo, typo, top-K).
- **Приложение** = **`RankingPipeline` / policy** — канонический порядок и веса; документ хранит только **signals** (`rankHint` и т.п.).

## Hit id до и после миграции (offering-hit-evolution)

- **После §3.2:** primary document id = **`organizationOfferingId`**.
- **До cutover:** листинг остаётся на текущем SQL path; не вводить **два конкурирующих hit id** в одной выдаче без явного ADR на dual-read window.

**Реализация (indexed listing):** при `SEARCH_LISTING_BACKEND=indexed` + Typesense коллекция **listing edges** (`TYPESENSE_LISTING_EDGES_COLLECTION`, по умолчанию `marketplace_listing_edges_v1`): документ с `id = SpecialistOffering.id` (ребро оффера × исполнитель, без `Service` в индексном hit). Выдача `GET /v1/specialists` — **group_by `specialistId`**, **`group_limit: 1`**; курсор v3 поле **`p`** — **страница** Typesense (`kb: didx_edge`). При фильтрах по **`bodyZoneSlugs`** путь принудительно **SQL**. Hit оффера (`OrganizationOffering`) — отдельная коллекция `marketplace_offerings_*`; id не смешиваются в одной выдаче.

## Бронирование: `BookingSnapshot` (§4)

- Таблица **1:1** с `Booking`: явные колонки (title, org name, specialist display, duration, price = выход `PricingResolver` на момент создания, currency, address line, city; опц. `payload Json`).
- **`snapshotSchemaVersion`** — версия контракта снимка; сборка полей — **единый сериализатор** в домене брони (`booking-snapshot.builder`), а не разрозненные вызовы Prisma.
- **После финализации брони** снимок **не обновляется** (`UPDATE` запрещён продуктовым правилом); исправления учёта — отдельный доменный сценарий, если когда-либо понадобится.

## Availability (§3): не часть агрегата оффера

- Слои слотов и read-model календаря — **отдельно** от **`OrganizationOffering`**; eventual, не блокирующие OLTP каталога.

## Transactional Outbox (§3.0.9)

- Запись outbox в **одной транзакции** с мутацией OLTP каталога; отдельный воркер диспатчит в очередь/индекс с **идемпотентными** consumers (`dedupeKey` / `(aggregateType, aggregateId, eventType)` по политике ADR реализации).

## SEO / tombstone / slug (§3.2.6–§3.2.9)

- **`published` → `hidden`/`archired`/`deleted`**: политика **301 vs 410**, sitemap pause, сохранение **стабильного `organizationOfferingId`** в аналитике; **переиспользование того же id под новый SKU запрещено**.
- **Partial unique** (`organizationId`, `slug`) **WHERE deletedAt IS NULL** в Postgres — техника многих slug после soft-delete.
- История смен slug — заготовка **`OrganizationOfferingSlugRevision`**, не обязательна Phase A.
- Mutable slug после publish = осознанный техдолг (редиректы, backlinks, ads).

## Адрес / geo roadmap (§7 см. дорожную карту)

- Сейчас **`Address`** не расширять ward/district/PostGIS без продукта. Горизонт **`OrganizationLocation`** и geo как **денормализуемое поле** документа поиска (evolution без «вечной» привязки к одной строке `addressLine`).

## Горизонт: навыки vs прайс

- Переименование домена **`SpecialistServiceCategory`** → **`SpecialistCapability` / SpecialistSkill`** — только с отдельным ADR миграции: **навык ≠ выполнение `OrganizationOffering`**.

## Архитектурные ограничения / non-goals (§6)

| Non-goal | Смысл |
|----------|--------|
| No event sourcing | Outbox/stream — транспорт, не replay-only SoT |
| No distributed transactions | Нет 2PC через Postgres + внешние системы |
| Search index disposable | Индекс пересобирается из OLTP |
| No realtime slot engine in Phase A | Matching слотов вне горячего пути каталога |
| No generic pricing DSL | Формула/`PricingResolver` сначала; rule engine вторым явным шагом |
| No cross-service synchronous consistency | Только eventual + контракты API |

- **`SearchEngine` — инфраструктура retrieval**, не владелец доменной истины ранга или цены.

## Онбординг: порядок шагов (продукт)

1. Кто ты / как работаешь (solo|business pattern).  
2. Вертикаль (major категории).  
3. **Capabilities** (`SpecialistServiceCategory` как навыки, не прайс).  
4. Где принимаешь (организация / join).  
5. Каталог **offerings** (после контекста точки).

Код: см. `SpecialistOnboardingStepOrder` в модуле специалистов.

## DDD: личный каталог мастера vs SKU точки

- Модель **`Service`** в Prisma — **capability** (личный каталог мастера / онбординг): навыки и привязка к категориям, а не каноническая коммерческая строка для гостевой записи.
- **`OrganizationOffering` + `SpecialistOffering`** — **SKU точки** и исполнение: витрина, цена, бронирование и поисковый hit (см. §3 ADR выше).
- Переименование таблицы `Service` в коде — отдельная миграция; до неё граница фиксируется языком в ADR и ревью.

## Публичный контракт каталога гостя

См. отдельно: [public-listing-contract.md](public-listing-contract.md) — единое правило read-path для листинга (projection / indexed listing vs OLTP).
