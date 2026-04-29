import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ModerationOllamaService } from './application/moderation-ollama.service';
import { ImageNsfwModerationService } from './application/image-nsfw-moderation.service';
import { ContentModerationService } from './application/content-moderation.service';
import { ModerationEnqueueService } from './application/moderation-enqueue.service';
import { ContentModerationController } from './presentation/content-moderation.controller';
import { ContentModeratorGuard } from './guards/content-moderator.guard';
import { ContentModerationProcessor } from './queue/content-moderation.processor';
import { CONTENT_MODERATION_QUEUE } from './queue/content-moderation-queue.const';
import { isModerationContentQueueEnabled } from './queue/moderation-queue-enabled';

const useModerationContentQueue = isModerationContentQueueEnabled();
const moderationContentQueue = useModerationContentQueue
  ? [BullModule.registerQueue({ name: CONTENT_MODERATION_QUEUE })]
  : [];

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
    ...moderationContentQueue,
  ],
  controllers: [ContentModerationController],
  providers: [
    ModerationOllamaService,
    ImageNsfwModerationService,
    ContentModerationService,
    ModerationEnqueueService,
    ...(useModerationContentQueue ? [ContentModerationProcessor] : []),
    ContentModeratorGuard,
  ],
  exports: [
    ContentModerationService,
    ModerationEnqueueService,
    ModerationOllamaService,
  ],
})
export class ModerationModule {}
