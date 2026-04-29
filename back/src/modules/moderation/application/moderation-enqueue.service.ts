import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ContentModerationService } from './content-moderation.service';
import {
  CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE,
  CONTENT_MODERATION_QUEUE,
} from '../queue/content-moderation-queue.const';

@Injectable()
export class ModerationEnqueueService {
  private readonly logger = new Logger(ModerationEnqueueService.name);

  constructor(
    private readonly contentModeration: ContentModerationService,
    @Optional()
    @Inject(getQueueToken(CONTENT_MODERATION_QUEUE))
    private readonly queue: Queue | undefined,
  ) {}

  /**
   * После успешного создания организации: job в BullMQ (если очередь поднята), иначе
   * сразу `moderateNewOrganizationProfile` в процессе (`MODERATION_QUEUE_ENABLED=false` или нет Redis).
   * Если очередь сконфигурирована, но `queue.add` упал (Redis недоступен и т.п.) — синхронный fallback.
   */
  async enqueueOrganizationProfileModeration(
    organizationId: string,
  ): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.add(CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE, {
          organizationId,
        });
        return;
      } catch (err: unknown) {
        const cause = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Не удалось добавить job в очередь BullMQ (модерация профиля салона, org=${organizationId}); выполняем moderateNewOrganizationProfile в этом процессе. Причина: ${cause}`,
        );
        await this.contentModeration.moderateNewOrganizationProfile(
          organizationId,
        );
        return;
      }
    }
    await this.contentModeration.moderateNewOrganizationProfile(organizationId);
    if (
      process.env.MODERATION_QUEUE_ENABLED !== 'false' &&
      !this.queue &&
      nodeEnvAllowsWarn()
    ) {
      this.logger.warn(
        'MODERATION_QUEUE_ENABLED не выключен, но очередь BullMQ не сконфигурирована — модерация профиля выполнена синхронно.',
      );
    }
  }
}

/** Dev/staging подсказка в лог, без заспама в prod при намеренной синхронной модели. */
function nodeEnvAllowsWarn(): boolean {
  const n = process.env.NODE_ENV;
  return n !== 'production';
}
