import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessPaymentDto {
  @ApiProperty({ description: 'Invoice to be paid', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() invoiceId!: string;

  @ApiProperty({ description: 'Amount to charge in integer halalas (1 SAR = 100)', example: 10000 })
  @IsInt() @Min(1) amount!: number;

  @ApiProperty({ description: 'Payment method used', enum: PaymentMethod, enumName: 'PaymentMethod' })
  @IsEnum(PaymentMethod) method!: PaymentMethod;

  @ApiPropertyOptional({ description: 'External gateway transaction reference', example: 'pay_abc123' })
  @IsOptional() @IsString() gatewayRef?: string;

  @ApiPropertyOptional({ description: 'Idempotency key to prevent duplicate charges', example: 'idem-2026-xyz' })
  @IsOptional() @IsString() idempotencyKey?: string;
}
