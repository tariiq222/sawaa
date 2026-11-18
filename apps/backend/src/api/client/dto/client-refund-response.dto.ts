import { ApiProperty } from '@nestjs/swagger';

/**
 * `POST /client/refunds/request` — `RequestRefundHandler` result.
 *
 * `amount` is integer halalas: the handler returns `Number(refundRequest.amount)`
 * and `createdAt` is an ISO string.
 *
 * Documentation only; no serializer is registered.
 */
export class ClientRefundRequestResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Refund request UUID', example: '00000000-0000-4000-a000-000000000050' })
  id!: string;

  @ApiProperty({ description: 'Refund request status (Prisma enum); always PENDING_REVIEW on creation', example: 'PENDING_REVIEW' })
  status!: string;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Refundable amount in halalas', example: 20000 })
  amount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;
}
