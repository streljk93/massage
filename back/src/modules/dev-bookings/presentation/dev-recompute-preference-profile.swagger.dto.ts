import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DevRecomputePreferenceProfileRequestSwaggerDto {
  @ApiProperty({
    type: String,
    format: 'email',
    description: 'Email пользователя (`User.email`)',
    example: 'user@example.com',
  })
  email!: string;

  @ApiPropertyOptional({
    enum: ['en', 'vi', 'ru'],
    description:
      'Локаль для проверки `readiness` по каталогу (без поля — `en`, как `parseApiLocale`).',
    example: 'ru',
  })
  locale?: 'en' | 'vi' | 'ru';
}

export class DevRecomputePreferenceProfileResponseSwaggerDto {
  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, format: 'email' })
  email!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Агрегат `PreferenceProfileV1` после пересчёта',
  })
  profile!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Сырьё для портрета: `fromFavorites` (string[]), `fromBookings` ([{slug, totalWeight}]), ' +
      '`fromBehaviorEventsLast30Days` ([{slug, weight}]), `behaviorEventRowsInWindow` (number).',
  })
  inputsConsidered!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      '`minCategorySlugsRequired`, `personalizationReady` (как GET рекомендаций без query), ' +
      '`homeBlockWouldRender` (и персонализация готова, и в каталоге есть сущности), ' +
      '`catalogListLimitUsed` (=3, как на главной), `catalogLocale`, ' +
      '`catalogSpecialistsCount`, `catalogOrganizationsCount`, `note` (радиус в проверке не передаётся).',
  })
  readiness!: Record<string, unknown>;
}
