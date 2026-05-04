import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_OLLAMA_MODERATION_MODEL } from '../../../config/moderation-defaults.const';

/** Вердикт модели JSON: показать сразу или отправить на ручную проверку. */
export type ModerationAiVerdict = 'pass' | 'review';

/** System prompt модератор UGC; текст для проверки передаётся отдельным user-сообщением (формат см. код). */
const MARKETPLACE_MODERATION_SYSTEM_PROMPT = [
  'Ты — система модерации пользовательского контента.',
  '',
  'Твоя задача — определить, содержит ли текст ЯВНЫЕ нарушения.',
  '',
  'Верни строго JSON без пояснений:',
  '',
  '{',
  '  "result": "pass" | "review",',
  '  "reason": string',
  '}',
  '',
  'Ставь "review" ТОЛЬКО если есть ЯВНОЕ нарушение:',
  '',
  '1. Прямые оскорбления или унижение (например: "ты идиот", "пошёл ...")',
  '2. Угрозы, агрессия, призывы к насилию',
  '3. Явная дискриминация (по расе, религии, полу и т.д.)',
  '4. Откровенный сексуальный контент',
  '5. Спам или навязчивые манипуляции (повторы, реклама с обманом)',
  '',
  'ВСЁ ОСТАЛЬНО считать безопасным (pass), включая:',
  '',
  '- Имена (например: Jenia, Alex, Nguyen)',
  '- Описание себя или услуг',
  '- Приветствия и обычный текст',
  '- Отзывы без агрессии',
  '- Любые нейтральные или дружелюбные сообщения',
  '',
  'ВАЖНО:',
  '- Не додумывай нарушения',
  '- Не интерпретируй нейтральный текст как токсичный',
  '- Если нет явного нарушения → всегда pass',
  '- Игнорируй язык (русский, английский, вьетнамский)',
  '',
  'Следующим сообщением придёт текст в блоке «Текст:» между тройными кавычками.',
].join('\n');

/**
 * В ответе Ollama при ошибке часто JSON: `{"error":"model 'x' not found"}` — для **POST /api/chat**
 * это даёт **HTTP 404**, хотя путь `/api/chat` верный (скорее неверное имя модели в `OLLAMA_MODEL`).
 */
function summarizeOllamaHttpFailure(
  status: number,
  bodyText: string,
): { rawSummary: string; logFragment: string } {
  let detail = bodyText.trim().slice(0, 450);
  try {
    const j = JSON.parse(bodyText.trim()) as { error?: string };
    if (typeof j.error === 'string' && j.error.length > 0) {
      detail = j.error.trim();
    }
  } catch {
    /* сырое тело */
  }
  const logFragment =
    detail.length > 0 ? `${status}: ${detail.slice(0, 420)}` : String(status);
  /** Для кейсов модерации (поле aiSummary) — понятнее, чем одно число «404». */
  let rawSummary: string;
  if (status === 404 && /model/i.test(detail)) {
    rawSummary =
      `HTTP 404 (${detail}). ` +
      `Укажите OLLAMA_MODEL как в локальном \`ollama list\`, либо: \`docker compose exec ollama ollama pull ` +
      `${DEFAULT_OLLAMA_MODERATION_MODEL}\` (дефолт проекта)`;
  } else {
    rawSummary = `HTTP ${status}${detail ? `: ${detail}` : ''}`;
  }
  return {
    rawSummary: rawSummary.slice(0, 500),
    logFragment,
  };
}

function normalizeOllamaBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    let pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    if (pathname.endsWith('/api/chat')) {
      pathname = pathname.slice(0, -'/api/chat'.length) || '/';
    } else if (pathname.endsWith('/api')) {
      pathname = pathname.slice(0, -'/api'.length) || '/';
    }
    parsed.pathname = pathname;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    let u = trimmed.replace(/\/+$/, '');
    if (/\/api\/chat$/i.test(u)) {
      u = u.replace(/\/api\/chat$/i, '').replace(/\/+$/, '');
    } else if (/\/api$/i.test(u)) {
      u = u.replace(/\/api$/i, '').replace(/\/+$/, '');
    }
    return u;
  }
}

@Injectable()
export class ModerationOllamaService {
  private readonly log = new Logger(ModerationOllamaService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string | null {
    const raw =
      this.config.get<string>('moderation.ollamaBaseUrl')?.trim() ?? '';
    if (raw.length === 0) {
      return null;
    }
    return normalizeOllamaBaseUrl(raw);
  }

  /**
   * Оценка текста витрины: текст в промпт уходит **как пришёл** (без trim/NFKC/normalize перед Ollama).
   * Если `OLLAMA_BASE_URL` пуст, `ENABLE_OLLAMA=false` или запрос упал — `verdict: review`;
   * `infraUnavailable: true` при инфраструктурных причинах.
   */
  async evaluateTexts(
    parts: ReadonlyArray<{ label: string; text: string }>,
  ): Promise<{
    verdict: ModerationAiVerdict;
    rawSummary: string | null;
    /** true: нет URL, HTTP не 2xx, таймаут, сеть — не ответ модели по контенту */
    infraUnavailable: boolean;
  }> {
    const asIsParts = parts.map((p) => ({
      label: p.label,
      text: p.text ?? '',
    }));

    const userPayload = asIsParts
      .filter((p) => p.text.length > 0)
      .map((p) => `[${p.label}]\n${p.text}`)
      .join('\n\n---\n\n');

    if (userPayload.length === 0) {
      return { verdict: 'pass', rawSummary: null, infraUnavailable: false };
    }

    if (!this.config.get<boolean>('moderation.ollamaEnabled')) {
      this.log.debug('ENABLE_OLLAMA=false — пропуск вызова Ollama');
      return {
        verdict: 'review',
        rawSummary: 'Ollama disabled (ENABLE_OLLAMA)',
        infraUnavailable: true,
      };
    }

    const base = this.baseUrl();
    if (base == null) {
      this.log.warn('OLLAMA_BASE_URL not set — treating as review');
      return {
        verdict: 'review',
        rawSummary: 'Ollama URL not configured',
        infraUnavailable: true,
      };
    }

    const model =
      this.config.get<string>('moderation.ollamaModel') ??
      DEFAULT_OLLAMA_MODERATION_MODEL;
    const timeoutMs =
      this.config.get<number>('moderation.requestTimeoutMs') ?? 90_000;

    const system = MARKETPLACE_MODERATION_SYSTEM_PROMPT;

    const url = `${base}/api/chat`;
    const body = {
      model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system' as const, content: system },
        {
          role: 'user' as const,
          content: ['Текст:', '"""', userPayload, '"""'].join('\n'),
        },
      ],
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        const { rawSummary, logFragment } = summarizeOllamaHttpFailure(
          res.status,
          t,
        );
        const extraBaseUrlHint =
          res.status === 404 && !/model/i.test(t)
            ? ' Если путь неверный: OLLAMA_BASE_URL только хост:порт (без /api/chat).'
            : '';
        this.log.warn(`Ollama ${logFragment}.${extraBaseUrlHint}`);
        return {
          verdict: 'review',
          rawSummary,
          infraUnavailable: true,
        };
      }
      const decoded = (await res.json()) as {
        message?: { content?: string };
      };
      const raw = decoded.message?.content?.trim();
      if (raw == null || raw === '') {
        return {
          verdict: 'review',
          rawSummary: 'empty model output',
          infraUnavailable: false,
        };
      }
      let parsed: { result?: string; verdict?: string; reason?: unknown };
      try {
        parsed = JSON.parse(raw) as {
          result?: string;
          verdict?: string;
          reason?: unknown;
        };
      } catch {
        return {
          verdict: 'review',
          rawSummary: raw.slice(0, 500),
          infraUnavailable: false,
        };
      }
      const outcome = parsed.result ?? parsed.verdict;
      const v = outcome === 'pass' ? 'pass' : 'review';
      const reasonStr = typeof parsed.reason === 'string' ? parsed.reason : '';
      const summary =
        [reasonStr || null, raw.slice(0, 200)].filter(Boolean).join(' · ') ||
        null;
      return {
        verdict: v,
        rawSummary: summary,
        infraUnavailable: false,
      };
    } catch (e) {
      this.log.warn(
        `Ollama request failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        verdict: 'review',
        rawSummary: e instanceof Error ? e.message : String(e),
        infraUnavailable: true,
      };
    }
  }
}
