import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Booking this invoice is for', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() bookingId!: string;

  @ApiProperty({ description: 'Branch where the service was delivered', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Client being invoiced', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee who delivered the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Subtotal before discount and tax', example: 100.00 })
  @IsNumber() @Min(0) subtotal!: number;

  @ApiPropertyOptional({ description: 'Flat discount amount', example: 10.00 })
  @IsOptional() @IsNumber() @Min(0) discountAmt?: number;

  @ApiPropertyOptional({ description: 'VAT rate as fraction (0..1). Defaults to OrganizationSettings.vatRate.', example: 0.15 })
  @IsOptional() @IsNumber() @Min(0) @Max(1) vatRate?: number;

  @ApiPropertyOptional({ description: 'Free-form invoice notes', example: 'Includes consultation fee' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'ISO datetime when payment is due', example: '2026-05-01T09:00:00.000Z' })
  @IsOptional() @IsDateString() dueAt?: string;
}
