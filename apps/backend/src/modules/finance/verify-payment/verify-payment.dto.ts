import { IsString, IsOptional, IsIn, IsDefined } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({ description: 'Verification decision', enum: ['approve', 'reject'], example: 'approve' })
  @IsDefined()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Bank transfer reference number (required when approving)', example: 'TRF-20260501-001' })
  @IsString()
  @IsOptional()
  transferRef?: string;
}
