import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Контракт: `docker/nsfw-image-moderation/app.py`. Других авто-путей модерации фото витрины в коде нет (Ollama не получает бинарники картинок). */
export const MODERATION_IMAGE_SCORE_HTTP_PATH = '/v1/score';

type ScoreResponse = {
  safe?: boolean;
  unsafe_score?: number;
  safe_score?: number;
};

export type OrgGalleryImageAssessment =
  | { kind: 'service_disabled' }
  | { kind: 'all_safe'; details?: string }
  | { kind: 'flagged_nsfw'; summary: string }
  | { kind: 'service_error'; summary: string };

/**
 * Автоматическая модерация **изображений** витрины: только этот клиент (`IMAGE_MODERATION_BASE_URL`).
 * По умолчанию в compose — контейнер `image-moderation` (docker/nsfw-image-moderation). Текст — Ollama.
 */
@Injectable()
export class ImageNsfwModerationService {
  private readonly log = new Logger(ImageNsfwModerationService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Контейнер image-moderation качает по URL; `127.0.0.1`/`localhost` там — не хост с Nest.
   * Подмена на `host.docker.internal` (см. extra_hosts в compose; Linux: host-gateway).
   * Отключить: `MODERATION_FETCH_USE_HOST_ALIAS=false`
   */
  private normalizeFileFetchOriginForDockerSidecar(raw: string): string {
    const t = raw.trim().replace(/\/+$/, '');
    if (t.length === 0) {
      return t;
    }
    if (process.env.MODERATION_FETCH_USE_HOST_ALIAS === 'false') {
      return t;
    }
    const nodeEnv = this.config.get<string>('nodeEnv');
    if (nodeEnv === 'production') {
      return t;
    }
    const modBase =
      this.config.get<string>('moderation.imageModeration.baseUrl')?.trim() ?? '';
    const modLooksLikeDockerSidecar =
      modBase.includes(':8085') ||
      modBase.includes('image-moderation') ||
      modBase.includes('host.docker.internal');
    if (!modLooksLikeDockerSidecar) {
      return t;
    }
    try {
      const u = new URL(t.startsWith('http') ? t : `http://${t}`);
      if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
        const prev = u.hostname;
        u.hostname = 'host.docker.internal';
        this.log.warn(
          `MODERATION_FILE_FETCH_ORIGIN host was ${prev}; using host.docker.internal so the image-moderation container can reach Nest on the host (or set MODERATION_FILE_FETCH_ORIGIN / MODERATION_FETCH_USE_HOST_ALIAS=false).`,
        );
      }
      return `${u.origin}`.replace(/\/+$/, '');
    } catch {
      return t;
    }
  }

  isEnabled(): boolean {
    const base =
      this.config.get<string>('moderation.imageModeration.baseUrl')?.trim() ?? '';
    return base.length > 0;
  }

  /** `GalleryItem.url` в БД часто `/v1/files/public/...` — для скачивания в NSFW-сервис нужен абсолютный URL. */
  resolvePublicUrl(stored: string): string | null {
    const t = stored.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) {
      return t;
    }
    const originRaw =
      this.config.get<string>('moderation.imageModeration.fileFetchOrigin')?.trim() ??
      '';
    if (originRaw.length === 0) {
      return null;
    }
    const origin =
      this.normalizeFileFetchOriginForDockerSidecar(originRaw).replace(/\/+$/, '');
    const path = t.startsWith('/') ? t : `/${t}`;
    return `${origin}${path}`;
  }

  async assessOrganizationGallery(
    storedUrls: readonly string[],
    maxImages = 30,
  ): Promise<OrgGalleryImageAssessment> {
    if (!this.isEnabled()) {
      return { kind: 'service_disabled' };
    }
    const base =
      this.config.get<string>('moderation.imageModeration.baseUrl')?.trim() ?? '';
    const threshold =
      this.config.get<number>('moderation.imageModeration.unsafeThreshold') ?? 0.5;
    const timeoutMs =
      this.config.get<number>('moderation.imageModeration.requestTimeoutMs') ?? 60_000;

    const slice = storedUrls.slice(0, maxImages);
    const summaries: string[] = [];

    let index = 0;
    for (const stored of slice) {
      index += 1;
      const resolved = this.resolvePublicUrl(stored);
      if (resolved == null) {
        return {
          kind: 'service_error',
          summary:
            `Не удалось построить абсолютный URL для картинки #${index}; задайте MODERATION_FILE_FETCH_ORIGIN.`,
        };
      }
      try {
        const url = `${base.replace(/\/+$/, '')}${MODERATION_IMAGE_SCORE_HTTP_PATH}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: resolved }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await res.text();
        if (!res.ok) {
          return {
            kind: 'service_error',
            summary: `NSFW service HTTP ${res.status} for image #${index}: ${text.slice(0, 400)}`,
          };
        }
        let decoded: ScoreResponse;
        try {
          decoded = JSON.parse(text) as ScoreResponse;
        } catch {
          return {
            kind: 'service_error',
            summary: `NSFW service returned non-JSON for image #${index}`,
          };
        }
        const unsafe =
          typeof decoded.unsafe_score === 'number' ? decoded.unsafe_score : 1;
        if (unsafe >= threshold) {
          summaries.push(
            `image #${index}: unsafe_score=${unsafe.toFixed(3)} (threshold ${threshold})`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(`Image NSFW scoring failed for gallery item ${index}: ${msg}`);
        return {
          kind: 'service_error',
          summary: `NSFW service error on image #${index}: ${msg.slice(0, 300)}`,
        };
      }
    }

    if (summaries.length > 0) {
      return {
        kind: 'flagged_nsfw',
        summary:
          `NSFW classifier flagged ${summaries.length}/${slice.length} image(s): ` +
          summaries.join('; '),
      };
    }
    return {
      kind: 'all_safe',
      details: `${slice.length} image(s) scanned (image moderation HTTP service)`,
    };
  }
}
