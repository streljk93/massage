import { ApiProperty } from '@nestjs/swagger';

export class DevWorkplaceJoinReviewSwaggerDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Идентификатор заявки (`SpecialistWorkplaceJoinRequest.id`), статус `pending`',
    example: '33333333-3333-4333-8333-333333333333',
  })
  requestId!: string;

  @ApiProperty({
    type: String,
    enum: ['accept', 'reject', 'block'],
    description:
      'accept — принять в коллектив; reject — отклонить; block — отклонить и запретить повторные заявки мастера в эту организацию.',
    example: 'accept',
  })
  decision!: 'accept' | 'reject' | 'block';
}
