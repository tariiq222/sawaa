import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPaymentDto {
  @ApiProperty({ description: 'Reason for the refund', example: 'Service not delivered' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Partial refund amount; omit to refund the full amount', example: 50.00 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;
}
