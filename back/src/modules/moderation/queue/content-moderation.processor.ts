import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ContentModerationService } from '../application/content-moderation.service';
import {
  CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE,
  CONTENT_MODERATION_QUEUE,
} from './content-moderation-queue.const';

@Injectable()
@Processor(CONTENT_MODERATION_QUEUE)
export class ContentModerationProcessor extends WorkerHost {
  constructor(
    private readonly contentModeration: ContentModerationService,
  ) {
    super();
  }

  async process(job: Job<{ organizationId?: string }>): Promise<void> {
    if (job.name !== CONTENT_MODERATION_JOB_ORGANIZATION_PROFILE) {
      throw new Error(`Unknown moderation job name: ${job.name}`);
    }
    const organizationId = job.data.organizationId;
    if (typeof organizationId !== 'string' || organizationId.length === 0) {
      throw new Error('organizationId missing in job data');
    }
    await this.contentModeration.moderateNewOrganizationProfile(organizationId);
  }
}
