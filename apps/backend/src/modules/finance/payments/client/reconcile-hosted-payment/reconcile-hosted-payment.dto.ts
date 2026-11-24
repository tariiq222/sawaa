import { ApiProperty } from '@nestjs/swagger';

export class ReconcileHostedPaymentResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Owned booking UUID that was checked',
    example: '11111111-1111-4111-8111-111111111111',
  })
  bookingId!: string;

  @ApiProperty({
    description: 'Current booking status (same semantics as the public booking status endpoint)',
    example: 'AWAITING_PAYMENT',
  })
  status!: string;

  @ApiProperty({
    description: "Status of the booking's latest payment, or NONE when it has no payment",
    example: 'PENDING',
  })
  paymentStatus!: string;

  @ApiProperty({
    description: 'True only when this call settled the hosted payment from the Moyasar state',
    example: false,
  })
  reconciled!: boolean;

  @ApiProperty({
    format: 'date-time',
    description: 'When this check ran (ISO 8601)',
    example: '2026-11-24T10:00:00.000Z',
  })
  checkedAt!: string;
}
