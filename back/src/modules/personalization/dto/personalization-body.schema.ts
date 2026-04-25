import { z } from 'zod';

const metadataSchema = z.record(z.string(), z.unknown()).optional();

export const personalizationEventItemSchema = z.object({
  eventType: z.string().min(1).max(64),
  entityType: z.string().min(1).max(32).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  metadata: metadataSchema,
});

export const ingestPersonalizationEventsBodySchema = z
  .object({
    sessionId: z.string().min(8).max(128).optional(),
    events: z.array(personalizationEventItemSchema).min(1).max(50),
  })
  .superRefine((data, ctx) => {
    const json = JSON.stringify(data.events);
    if (json.length > 48_000) {
      ctx.addIssue({
        code: 'custom',
        message: 'events payload too large',
        path: ['events'],
      });
    }
  });

export type IngestPersonalizationEventsBody = z.infer<
  typeof ingestPersonalizationEventsBodySchema
>;
