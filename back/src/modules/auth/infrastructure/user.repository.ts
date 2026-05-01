import { Injectable } from '@nestjs/common';
import {
  PlatformRole,
  Prisma,
  type PublicationModerationStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  catalogListedName: string | null;
  nameModerationStatus: PublicationModerationStatus;
  passwordHash: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  /** Локаль UI из приложения (en / ru / vi); письма и подписи статусов опираются на неё. */
  locale: string | null;
  bookingReminderEnabled: boolean;
  bookingReminderLeadMinutes: number;
  platformRole: PlatformRole;
  isContentModerator: boolean;
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
    return row;
  }

  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        emailVerifiedAt: null,
      },
    });
  }

  async setEmailVerifiedAt(
    id: string,
    at: Date = new Date(),
  ): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: at },
    });
  }

  async findActiveById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async updateProfile(
    id: string,
    data: {
      name?: string;
      catalogListedName?: string | null;
      avatarUrl?: string | null;
      locale?: string | null;
      bookingReminderEnabled?: boolean;
      bookingReminderLeadMinutes?: number;
    },
  ): Promise<UserRecord | null> {
    const existing = await this.findActiveById(id);
    if (!existing) {
      return null;
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.catalogListedName !== undefined
          ? { catalogListedName: data.catalogListedName }
          : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(data.bookingReminderEnabled !== undefined
          ? { bookingReminderEnabled: data.bookingReminderEnabled }
          : {}),
        ...(data.bookingReminderLeadMinutes !== undefined
          ? { bookingReminderLeadMinutes: data.bookingReminderLeadMinutes }
          : {}),
      },
    });
  }

  isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
