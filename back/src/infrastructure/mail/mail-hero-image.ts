import type { ConfigService } from '@nestjs/config';

/**
 * Абсолютный URL статики в шапке писем (`client/public`, см. `mail.clientAppOrigin`, `mail.reminderHeroImagePath`).
 * Пустая строка, если origin не задан (production без `CLIENT_ORIGIN`).
 */
export function mailHeroImageUrlFromConfig(config: ConfigService): string {
  const origin = (
    config.get<string>('mail.clientAppOrigin') ?? ''
  ).replace(/\/$/, '');
  const pathRaw =
    config.get<string>('mail.reminderHeroImagePath') ?? '/massage.png';
  const heroPath = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;
  return origin ? `${origin}${heroPath}` : '';
}
