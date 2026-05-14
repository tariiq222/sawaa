import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoyasarWebhookMetadataDto {
  @ApiPropertyOptional({ description: 'Invoice UUID embedded in the payment metadata', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsString() invoiceId?: string;
}

export class MoyasarWebhookDto {
  @ApiProperty({ description: 'Moyasar payment ID', example: 'pay_abc123' })
  @IsString() id!: string;

  @ApiProperty({ description: 'Payment status reported by Moyasar', enum: ['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'], example: 'paid' })
  @IsIn(['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided']) status!: 'paid' | 'failed' | 'refunded' | 'authorized' | 'captured' | 'voided';

  @ApiProperty({ description: 'Amount in the smallest currency unit (halalas)', example: 10000 })
  @IsInt() @Min(1) @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value)) amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'SAR' })
  @IsString() @IsIn(['SAR']) currency!: string;

  @ApiPropertyOptional({ description: 'Metadata attached when the payment was initiated', type: () => MoyasarWebhookMetadataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookMetadataDto)
  metadata?: MoyasarWebhookMetadataDto;

  @ApiPropertyOptional({ description: 'Human-readable message from Moyasar (e.g. failure reason)', example: 'Insufficient funds' })
  @IsOptional() @IsString() message?: string;

  @ApiPropertyOptional({ description: 'Indicates if the payment was made in live mode', example: true })
  @IsOptional() live?: unknown;

  @ApiPropertyOptional({ description: 'Additional payment data' })
  @IsOptional() data?: unknown;

  @ApiPropertyOptional({ description: 'Payment type', example: 'payment' })
  @IsOptional() @IsString() type?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp when the payment was created', example: '2024-01-15T10:30:00Z' })
  @IsOptional() @IsString() created_at?: string;

  @ApiPropertyOptional({ description: 'Secret token for payment verification' })
  @IsOptional() @IsString() secret_token?: string;

  @ApiPropertyOptional({ description: 'Name of the account associated with the payment', example: 'My Account' })
  @IsOptional() @IsString() account_name?: string;
}
