import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from './jwt-access.guard';

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  tokenUse: 'access' | 'refresh';
};

/**
 * Bearer отсутствует — гость (`user` не заполняется). Bearer есть — валидация как у
 * {@link JwtAccessGuard}; невалидный токен → 401.
 */
@Injectable()
export class JwtAccessOptionalGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return true;
    }
    const token = auth.slice('Bearer '.length).trim();
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid or expired access token',
      });
    }
    if (payload.tokenUse !== 'access') {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token required',
      });
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
    return true;
  }
}
