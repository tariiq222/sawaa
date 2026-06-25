import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, Validate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class InvoiceXorConstraint {
  validate(dto: CreateInvoiceDto) {
    const hasBooking = !!dto.bookingId;
    const hasPackage = !!dto.packagePurchaseId;
    return (hasBooking && !hasPackage) || (!hasBooking && hasPackage);
  }

  defaultMessage() {
    return 'Exactly one of bookingId or packagePurchaseId must be provided (XOR)';
  }
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Booking this invoice is for (XOR with packagePurchaseId)', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() bookingId?: string | null;

  @ApiPropertyOptional({ description: 'Session-package purchase this invoice is for (XOR with bookingId)', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() packagePurchaseId?: string | null;

  @ApiProperty({ description: 'Branch where the service was delivered', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Client being invoiced', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Employee who delivered the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Subtotal before discount and tax in integer halalas (1 SAR = 100)', example: 10000 })
  @IsInt() @Min(0) subtotal!: number;

  @ApiPropertyOptional({ description: 'Flat discount amount in integer halalas (1 SAR = 100)', example: 1000 })
  @IsOptional() @IsInt() @Min(0) discountAmt?: number;

  @ApiPropertyOptional({ description: 'VAT rate as fraction (0..1). Defaults to OrganizationSettings.vatRate.', example: 0 })
  @IsOptional() @IsNumber() @Min(0) @Max(1) vatRate?: number;

  @ApiPropertyOptional({ description: 'Free-form invoice notes', example: 'Includes consultation fee' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'ISO datetime when payment is due', example: '2026-05-01T09:00:00.000Z' })
  @IsOptional() @IsDateString() dueAt?: string;

  @Validate(InvoiceXorConstraint)
  _xorCheck?: unknown;
}
