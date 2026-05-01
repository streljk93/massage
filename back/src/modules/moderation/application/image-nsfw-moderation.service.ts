import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Контракт: `docker/nsfw-image-moderation/app.py`. Других авто-путей модерации фото витрины в коде нет (Ollama не получает бинарники картинок). */
export const MODERATION_IMAGE_SCORE_HTTP_PATH = '/v1/score';

type ScoreClip = {
  enabled?: boolean;
  review_recommended?: boolean;
  threshold?: number;
  scores?: Record<string, unknown>;
};
export type ModerationSidecarScoreResponse = {
  safe?: boolean;
  unsafe_score?: number;
  safe_score?: number;
  clip?: ScoreClip;
};
type ScoreResponse = ModerationSidecarScoreResponse;

export type OrgGalleryImageAssessment =
  | { kind: 'service_disabled' }
  | { kind: 'all_safe'; details?: string }
  | { kind: 'flagged_nsfw'; summary: string }
  | { kind: 'service_error'; summary: string };

/**
 * Автоматическая модерация **изображений** витрины: только этот клиент (`IMAGE_MODERATION_BASE_URL`).
 * Контейнер `image-moderation`: NudeNet (тело/NSFW) + OpenCLIP (violence/blood/gore/injury/weapon). Текст — Ollama.
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
      this.config.get<string>('moderation.imageModeration.baseUrl')?.trim() ??
      '';
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
      this.config.get<string>('moderation.imageModeration.baseUrl')?.trim() ??
      '';
    return base.length > 0;
  }

  /** `GalleryItem.url` в БД часто `/v1/files/public/...` — для скачивания в NSFW-сервис нужен абсолютный URL. */
  resolvePublicUrl(stored: string): string | null {
    const t = stored.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) {
      return t;
    }
    const originRaw =
      this.config
        .get<string>('moderation.imageModeration.fileFetchOrigin')
        ?.trim() ?? '';
    if (originRaw.length === 0) {
      return null;
    }
    const origin = this.normalizeFileFetchOriginForDockerSidecar(
      originRaw,
    ).replace(/\/+$/, '');
    const path = t.startsWith('/') ? t : `/${t}`;
    return `${origin}${path}`;
  }

  /**
   * POST `IMAGE_MODERATION_BASE_URL`/v1/score — один байнд для витрины и dev Swagger.
   * `resolvedImageUrl` — уже абсолютный URL, видимый контейнеру image-moderation (см. `resolvePublicUrl`).
   */
  async postScoreForImageUrl(resolvedImageUrl: string): Promise<
    | { ok: true; decoded: ScoreResponse }
    | {
        ok: false;
        /** HTTP от sidecar, если докатились до ответа; при сетевой ошибке может отсутствовать */
        httpStatus?: number;
        message: string;
      }
  > {
    const base =
      this.config.get<string>('moderation.imageModeration.baseUrl')?.trim() ??
      '';
    const timeoutMs =
      this.config.get<number>('moderation.imageModeration.requestTimeoutMs') ??
      60_000;
    if (base.length === 0) {
      return { ok: false, message: 'IMAGE_MODERATION_BASE_URL не задан' };
    }
    try {
      const url = `${base.replace(/\/+$/, '')}${MODERATION_IMAGE_SCORE_HTTP_PATH}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: resolvedImageUrl }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          ok: false,
          httpStatus: res.status,
          message:
            text.length > 0
              ? `NSFW service HTTP ${res.status}: ${text.slice(0, 600)}`
              : `NSFW service HTTP ${res.status}`,
        };
      }
      let decoded: ScoreResponse;
      try {
        decoded = JSON.parse(text) as ScoreResponse;
      } catch {
        return {
          ok: false,
          httpStatus: res.status,
          message: 'NSFW service returned non-JSON',
        };
      }
      return { ok: true, decoded };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        message: `NSFW service error: ${msg.slice(0, 600)}`,
      };
    }
  }

  /**
   * [Dev/Swagger] Сырой JSON от контейнера image-moderation (NudeNet + CLIP) по уже разрешённому URL.
   */
  async scoreSingleImageDev(resolvedImageUrl: string): Promise<
    | { infra_disabled: true }
    | {
        infra_disabled: false;
        ok: true;
        /** Полезная нагрузка sidecar при HTTP 200 + JSON */
        score: ModerationSidecarScoreResponse;
      }
    | {
        infra_disabled: false;
        ok: false;
        http_status?: number;
        /** Текст при ошибке сети/HTTP/non-JSON */
        error: string;
      }
  > {
    if (!this.isEnabled()) {
      return { infra_disabled: true };
    }
    const r = await this.postScoreForImageUrl(resolvedImageUrl);
    if (r.ok) {
      return { infra_disabled: false, ok: true, score: r.decoded };
    }
    return {
      infra_disabled: false,
      ok: false,
      ...(r.httpStatus != null ? { http_status: r.httpStatus } : {}),
      error: r.message,
    };
  }

  async assessOrganizationGallery(
    storedUrls: readonly string[],
    maxImages = 30,
  ): Promise<OrgGalleryImageAssessment> {
    if (!this.isEnabled()) {
      return { kind: 'service_disabled' };
    }
    const threshold =
      this.config.get<number>('moderation.imageModeration.unsafeThreshold') ??
      0.5;
    const clipThreshold =
      this.config.get<number>(
        'moderation.imageModeration.clipReviewThreshold',
      ) ?? 0.7;

    const slice = storedUrls.slice(0, maxImages);
    const summaries: string[] = [];

    let index = 0;
    for (const stored of slice) {
      index += 1;
      const resolved = this.resolvePublicUrl(stored);
      if (resolved == null) {
        return {
          kind: 'service_error',
          summary: `Не удалось построить абсолютный URL для картинки #${index}; задайте MODERATION_FILE_FETCH_ORIGIN.`,
        };
      }
      const scored = await this.postScoreForImageUrl(resolved);
      if (!scored.ok) {
        return {
          kind: 'service_error',
          summary: `NSFW service error for image #${index}: ${scored.message.slice(0, 400)}`,
        };
      }
      const decoded = scored.decoded;
      const unsafe =
        typeof decoded.unsafe_score === 'number' ? decoded.unsafe_score : 1;
      const nudeFlagged = unsafe >= threshold;

      const harmKeys = [
        'violence',
        'blood',
        'gore',
        'injury',
        'weapon',
      ] as const;

      let clipFlagged = false;
      const clip = decoded.clip;
      if (clip?.enabled === true) {
        if (clip.review_recommended === true) {
          clipFlagged = true;
        } else if (clip.scores && typeof clip.scores === 'object') {
          for (const k of harmKeys) {
            const v = clip.scores[k];
            if (typeof v === 'number' && v > clipThreshold) {
              clipFlagged = true;
              break;
            }
          }
        }
      }

      if (!nudeFlagged && !clipFlagged) {
        continue;
      }

      const parts: string[] = [];
      if (nudeFlagged) {
        parts.push(
          `NudeNet unsafe_score=${unsafe.toFixed(3)} (threshold ${threshold})`,
        );
      }
      if (clipFlagged) {
        const s = clip?.scores ?? {};
        const clipBits = harmKeys
          .filter((k) => typeof s[k] === 'number')
          .map((k) => `${k}=${Number(s[k]).toFixed(3)}`);
        parts.push(
          `CLIP (${clipBits.length ? clipBits.join(', ') : `threshold ${clipThreshold}`})`,
        );
      }
      summaries.push(`image #${index}: ${parts.join('; ')}`);
    }

    if (summaries.length > 0) {
      return {
        kind: 'flagged_nsfw',
        summary:
          `Image moderation flagged ${summaries.length}/${slice.length} image(s): ` +
          summaries.join('; '),
      };
    }
    return {
      kind: 'all_safe',
      details: `${slice.length} image(s) scanned (NudeNet + CLIP pairwise; image moderation service)`,
    };
  }
}
