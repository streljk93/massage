import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../common/guards';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Только пользователи с `User.isContentModerator` (флаг в БД).
 */
@Injectable()
export class ContentModeratorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const id = req.user?.id;
    if (id == null) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Forbidden',
      });
    }
    const row = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { isContentModerator: true },
    });
    if (row?.isContentModerator !== true) {
      throw new ForbiddenException({
        code: 'NOT_CONTENT_MODERATOR',
        message: 'Content moderator role required',
      });
    }
    return true;
  }
}
