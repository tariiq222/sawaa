import { IsString, IsNotEmpty, IsInt, IsOptional, Min, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({ description: 'Reason for the refund', example: 'Service not delivered' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Partial refund amount in integer halalas (1 SAR = 100); omit to refund the full amount', example: 5000 })
  @IsInt()
  @IsOptional()
  @Min(1)
  amount?: number;
}

export class ManualRefundPaymentDto extends RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Existing pending cash/bank-transfer refund request to settle; retries return the existing completion', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  refundRequestId?: string;

  /**
   * Client-generated retry key. Cash refunds are settled at the counter, so a
   * browser retry or a double-tap used to pay the client twice: the second
   * request saw a still-positive outstanding balance and created a second
   * COMPLETED refund (PAY-05). Send the same key for every retry of the same
   * logical payout; the stored unique key makes the replay return the original
   * completion instead of moving more money.
   */
  @ApiPropertyOptional({
    description: 'Client-generated idempotency key for this refund attempt; retries must reuse it',
    example: 'refund-attempt-6f1c2b7e',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  idempotencyKey?: string;
}
