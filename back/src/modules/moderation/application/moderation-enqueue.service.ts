import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ContentModerationService } from './content-moderation.service';
import {
  CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE,
  CONTENT_MODERATION_JOB_SPECIALIST_PROFILE,
  CONTENT_MODERATION_QUEUE,
} from '../queue/content-moderation-queue.const';

@Injectable()
export class ModerationEnqueueService {
  private readonly logger = new Logger(ModerationEnqueueService.name);

  constructor(
    @Inject(ContentModerationService)
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
    organizationProfileRevisionId: string,
  ): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.add(CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE, {
          organizationProfileRevisionId,
        });
        return;
      } catch (err: unknown) {
        const cause = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Не удалось добавить job в очередь BullMQ (модерация профиля салона, revision=${organizationProfileRevisionId}); выполняем moderateOrganizationProfileRevision в этом процессе. Причина: ${cause}`,
        );
        await this.contentModeration.moderateOrganizationProfileRevision(
          organizationProfileRevisionId,
        );
        return;
      }
    }
    await this.contentModeration.moderateOrganizationProfileRevision(
      organizationProfileRevisionId,
    );
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

  /**
   * После сохранения черновика витрины мастера: job в BullMQ при наличии очереди, иначе
   * `moderateSpecialistProfileRevision` в этом процессе (как у организаций).
   */
  async enqueueSpecialistProfileModeration(
    specialistProfileRevisionId: string,
  ): Promise<void> {
    if (this.queue) {
      try {
        await this.queue.add(CONTENT_MODERATION_JOB_SPECIALIST_PROFILE, {
          specialistProfileRevisionId,
        });
        return;
      } catch (err: unknown) {
        const cause = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Не удалось добавить job в BullMQ (модерация профиля мастера, revision=${specialistProfileRevisionId}); выполняем moderateSpecialistProfileRevision в этом процессе. Причина: ${cause}`,
        );
        await this.contentModeration.moderateSpecialistProfileRevision(
          specialistProfileRevisionId,
        );
        return;
      }
    }
    await this.contentModeration.moderateSpecialistProfileRevision(
      specialistProfileRevisionId,
    );
    if (
      process.env.MODERATION_QUEUE_ENABLED !== 'false' &&
      !this.queue &&
      nodeEnvAllowsWarn()
    ) {
      this.logger.warn(
        'MODERATION_QUEUE_ENABLED не выключен, но очередь BullMQ не сконфигурирована — модерация профиля мастера выполнена синхронно.',
      );
    }
  }
}

/** Dev/staging подсказка в лог, без заспама в prod при намеренной синхронной модели. */
function nodeEnvAllowsWarn(): boolean {
  const n = process.env.NODE_ENV;
  return n !== 'production';
}
