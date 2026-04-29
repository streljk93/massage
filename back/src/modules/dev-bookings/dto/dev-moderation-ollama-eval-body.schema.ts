import { z } from 'zod';

/** Тело `[Dev] POST …/moderation/ollama-eval`: произвольный текст для пробного запуска через Ollama. */
export const devModerationOllamaEvalBodySchema = z.object({
  text: z.string().min(1).max(64000),
  /** Необязательная метка в промпте (по умолчанию `preview`). */
  label: z.string().min(1).max(64).optional(),
});

export type DevModerationOllamaEvalBody = z.infer<
  typeof devModerationOllamaEvalBodySchema
>;
