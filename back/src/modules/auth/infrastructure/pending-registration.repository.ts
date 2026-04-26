import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class PendingRegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(data: {
    email: string;
    name: string;
    passwordHash: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<{ id: string; email: string; name: string }> {
    return this.prisma.pendingRegistration.upsert({
      where: { email: data.email },
      create: data,
      update: {
        name: data.name,
        passwordHash: data.passwordHash,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
      },
      select: { id: true, email: true, name: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.pendingRegistration.findUnique({
      where: { email },
    });
  }

  updateOtp(
    email: string,
    data: { codeHash: string; expiresAt: Date },
  ): Promise<void> {
    return this.prisma.pendingRegistration
      .update({
        where: { email },
        data,
      })
      .then(() => undefined);
  }
}
