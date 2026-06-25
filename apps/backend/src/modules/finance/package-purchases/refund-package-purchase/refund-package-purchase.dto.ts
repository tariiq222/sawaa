import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPackagePurchaseDto {
  @ApiProperty({
    description:
      'Refund amount in integer halalas (1 SAR = 100). Must be between 0 and the amount paid. ' +
      '0 records a cancellation with no money returned.',
    example: 50000,
  })
  @IsInt()
  @Min(0)
  refundAmount!: number;

  @ApiPropertyOptional({
    description: 'Reason / note for the manual refund (appended to the purchase notes)',
    example: 'Client moved abroad',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
