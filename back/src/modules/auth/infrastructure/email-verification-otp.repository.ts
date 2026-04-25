import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class EmailVerificationOtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    userId: string,
    data: { codeHash: string; expiresAt: Date },
  ): Promise<void> {
    await this.prisma.emailVerificationOtp.upsert({
      where: { userId },
      create: {
        userId,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
      },
      update: {
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.emailVerificationOtp.findUnique({
      where: { userId },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.emailVerificationOtp.deleteMany({ where: { userId } });
  }
}
