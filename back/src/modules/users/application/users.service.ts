import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../auth/infrastructure/user.repository';
import type { PatchMeBody } from '../dto/patch-me-body.schema';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

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
      bookingReminderEnabled: user.bookingReminderEnabled,
      bookingReminderLeadMinutes: user.bookingReminderLeadMinutes,
    };
  }

  async patchMe(userId: string, body: PatchMeBody) {
    const updated = await this.userRepository.updateProfile(userId, {
      name: body.name,
      avatarUrl: body.avatarUrl,
      bookingReminderEnabled: body.bookingReminderEnabled,
      bookingReminderLeadMinutes: body.bookingReminderLeadMinutes,
    });
    if (!updated) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      bookingReminderEnabled: updated.bookingReminderEnabled,
      bookingReminderLeadMinutes: updated.bookingReminderLeadMinutes,
    };
  }
}
