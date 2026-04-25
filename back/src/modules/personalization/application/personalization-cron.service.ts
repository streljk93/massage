import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PersonalizationService } from './personalization.service';

@Injectable()
export class PersonalizationCronService {
  private readonly logger = new Logger(PersonalizationCronService.name);

  constructor(
    private readonly personalizationService: PersonalizationService,
  ) {}

  /** Каждые 30 минут: пересчёт портретов пакетом. */
  @Cron('0 */30 * * * *')
  async recomputeBatch(): Promise<void> {
    try {
      const r = await this.personalizationService.recomputeProfilesBatch();
      if (r.processed > 0) {
        this.logger.log(
          `Personalization recompute: processed ${r.processed} users`,
        );
      }
    } catch (e) {
      this.logger.error(
        `Personalization recompute failed: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Раз в сутки (02:15 UTC): удаление сырых событий витрины старше retention.
   * Портреты (`UserPreferenceProfile`) не трогаем.
   */
  @Cron('0 15 2 * * *')
  async purgeStaleBehaviorEvents(): Promise<void> {
    try {
      await this.personalizationService.purgeStaleBehaviorEvents();
    } catch (e) {
      this.logger.error(
        `Personalization retention purge failed: ${(e as Error).message}`,
      );
    }
  }
}
