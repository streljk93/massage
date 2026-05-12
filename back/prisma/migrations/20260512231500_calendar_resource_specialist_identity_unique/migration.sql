-- Один специалист в одной организации должен иметь один identity-ресурс календаря.
-- Дубли, которые могли появиться до инварианта, оставляем для истории событий,
-- но отвязываем от specialistId и скрываем из текущих календарных выборок.

WITH ranked_specialist_resources AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "specialistId", "type"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "CalendarResource"
  WHERE "type" = 'specialist'
    AND "specialistId" IS NOT NULL
)
UPDATE "CalendarResource" AS cr
SET
  "isActive" = false,
  "specialistId" = NULL,
  "deletedAt" = COALESCE(cr."deletedAt", NOW())
FROM ranked_specialist_resources AS ranked
WHERE cr.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarResource_specialist_identity_unique"
  ON "CalendarResource" ("organizationId", "specialistId", "type")
  WHERE "type" = 'specialist'
    AND "specialistId" IS NOT NULL;
