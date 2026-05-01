import { Injectable, NotFoundException } from '@nestjs/common';
import { PublicationModerationStatus } from '@prisma/client';
import { UserRepository } from '../../auth/infrastructure/user.repository';
import { ContentModerationService } from '../../moderation/application/content-moderation.service';
import type { PatchMeBody } from '../dto/patch-me-body.schema';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly contentModeration: ContentModerationService,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepository.findActiveById(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      bookingReminderEnabled: user.bookingReminderEnabled,
      bookingReminderLeadMinutes: user.bookingReminderLeadMinutes,
      platformRole: user.platformRole,
      isContentModerator: user.isContentModerator,
    };
  }

  async patchMe(userId: string, body: PatchMeBody) {
    const prev = await this.userRepository.findActiveById(userId);
    const freezeCatalog =
      prev != null &&
      body.name !== undefined &&
      body.name.trim() !== prev.name.trim() &&
      prev.nameModerationStatus === PublicationModerationStatus.approved;
    const updated = await this.userRepository.updateProfile(userId, {
      name: body.name,
      avatarUrl: body.avatarUrl,
      locale: body.locale,
      bookingReminderEnabled: body.bookingReminderEnabled,
      bookingReminderLeadMinutes: body.bookingReminderLeadMinutes,
      ...(freezeCatalog
        ? {
            catalogListedName: prev.catalogListedName ?? prev.name,
          }
        : {}),
    });
    if (!updated) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    if (
      prev != null &&
      body.name !== undefined &&
      body.name.trim() !== prev.name.trim()
    ) {
      await this.contentModeration.moderateDisplayNameAfterPatch(
        userId,
        updated.name,
      );
    }
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      locale: updated.locale,
      bookingReminderEnabled: updated.bookingReminderEnabled,
      bookingReminderLeadMinutes: updated.bookingReminderLeadMinutes,
      platformRole: updated.platformRole,
      isContentModerator: updated.isContentModerator,
    };
  }
}
