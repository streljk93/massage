import { Injectable } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class OAuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserIdByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<string | null> {
    const row = await this.prisma.userOAuthAccount.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
      select: { userId: true },
    });
    return row?.userId ?? null;
  }

  async createLink(data: {
    userId: string;
    provider: OAuthProvider;
    providerAccountId: string;
  }): Promise<void> {
    await this.prisma.userOAuthAccount.create({ data });
  }
}
