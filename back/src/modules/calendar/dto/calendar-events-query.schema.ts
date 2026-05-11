import { z } from 'zod';

function normalizeArray(val: unknown): unknown {
  if (val === undefined || val === '') {
    return undefined;
  }
  if (Array.isArray(val)) {
    return val.filter((v): v is string => typeof v === 'string' && v !== '');
  }
  if (typeof val === 'string') {
    return [val];
  }
  if (val !== null && typeof val === 'object') {
    const raw = val as Record<string, unknown>;
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => raw[k])
      .filter((v): v is string => typeof v === 'string' && v !== '');
  }
  return undefined;
}

export const calendarEventsQuerySchema = z.preprocess(
  (input) => {
    const raw =
      input !== null && typeof input === 'object' && !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};
    return {
      from: raw.from,
      to: raw.to,
      resourceIds:
        raw.resourceIds !== undefined
          ? normalizeArray(raw.resourceIds)
          : normalizeArray(raw['resourceIds[]']),
      limit: raw.limit,
      cursor: raw.cursor,
    };
  },
  z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    resourceIds: z.array(z.string().uuid()).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursor: z.string().min(1).optional(),
  }),
);

export type CalendarEventsQuery = z.infer<typeof calendarEventsQuerySchema>;
