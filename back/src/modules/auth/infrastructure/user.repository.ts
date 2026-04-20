import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
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
      },
    });
  }

  async findActiveById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
