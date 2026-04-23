import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Скрывает dev-only HTTP-ручки (тестовые/отладочные) вне разрешённых условий.
 * В production и при `DISABLE_DEV_TEST_ROUTES=true` — 404.
 */
@Injectable()
export class DevTestRoutesGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const enabled = this.config.get<boolean>('devTestRoutes.enabled', false);
    if (!enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
