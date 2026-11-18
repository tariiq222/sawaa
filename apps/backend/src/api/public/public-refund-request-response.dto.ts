import { ApiProperty } from '@nestjs/swagger';

/**
 * Swagger response shape for `POST /public/refunds/request`
 * (`RequestRefundHandler` → `RefundRequestResult`).
 *
 * A request only creates a PENDING_REVIEW row; no money moves on this route.
 * `amount` is the refundable balance of the invoice's payment in integer
 * halalas (the handler returns `Number(refundRequest.amount)`), and
 * `createdAt` is an ISO 8601 string.
 *
 * Documentation only — no serializer is registered.
 */
export class PublicRefundRequestResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Refund request UUID', example: '00000000-0000-4000-a000-000000000050' })
  id!: string;

  @ApiProperty({
    description: 'Refund request status (Prisma enum value); always PENDING_REVIEW on creation',
    example: 'PENDING_REVIEW',
  })
  status!: string;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Refundable amount in halalas', example: 20000 })
  amount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant (ISO 8601 UTC)', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;
}
