import { IsString, IsNotEmpty, IsInt, IsOptional, Min, IsUUID } from 'class-validator';
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
}
