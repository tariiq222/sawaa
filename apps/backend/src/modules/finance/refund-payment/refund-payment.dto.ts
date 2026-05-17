import { IsString, IsNotEmpty, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({ description: 'Reason for the refund', example: 'Service not delivered' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Partial refund amount in integer halalas (1 SAR = 100); omit to refund the full amount', example: 5000 })
  @IsInt()
  @IsOptional()
  @Min(0)
  amount?: number;
}
