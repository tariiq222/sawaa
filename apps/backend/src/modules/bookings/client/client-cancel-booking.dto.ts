import { IsString, IsOptional, IsUUID, Equals, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClientCancelBookingDto {
  @ApiPropertyOptional({ description: 'Reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: 'Explicit acceptance of the displayed current cancellation and refund terms', enum: [true] })
  @Equals(true)
  acceptedRefundTerms!: true;

  @ApiProperty({ description: 'Current cancellation preview fingerprint; refresh and reconfirm after conflict', pattern: '^[a-f0-9]{64}$' })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  quoteToken!: string;

  @ApiPropertyOptional({ description: 'Stable UUID for retrying the same cancellation', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceActionId?: string;
}
