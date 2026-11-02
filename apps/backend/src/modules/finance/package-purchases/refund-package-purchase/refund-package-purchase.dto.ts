import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundPackagePurchaseDto {
  @ApiProperty({
    description:
      'Refund amount in integer halalas (1 SAR = 100). Must be between 0 and the amount charged (the invoice total, VAT-inclusive). ' +
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

  /**
   * Client-generated retry key. A browser retry of the same partial refund
   * otherwise passes the outstanding clamp a second time and pays the client
   * twice (PAY-05). Reusing the key replays the original completion.
   */
  @ApiPropertyOptional({
    description: 'Client-generated idempotency key for this refund attempt; retries must reuse it',
    example: 'package-refund-6f1c2b7e',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
