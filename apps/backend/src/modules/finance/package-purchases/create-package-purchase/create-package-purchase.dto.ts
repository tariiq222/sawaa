import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

/**
 * Reception staff sells a SessionPackage to a client at the desk.
 *
 * The handler freezes prices, creates the PackagePurchase + a PackageCredit
 * bucket per package item, issues ONE invoice for the full amount, records
 * the manual payment, and activates the credits immediately.
 */
export class CreatePackagePurchaseDto {
  @ApiProperty({ description: 'Session package being sold', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() packageId!: string;

  @ApiProperty({ description: 'Client buying the package', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() clientId!: string;

  @ApiProperty({ description: 'Branch where the sale happens', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiPropertyOptional({
    description: 'Optional employee reference (e.g. the practitioner associated with the first item). Stored as a plain string on the invoice — no Prisma FK.',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional() @IsUUID() employeeId?: string;

  @ApiProperty({
    description: 'Manual payment method used at the desk (reception flow). ONLINE_CARD is rejected — online card sales happen through the Moyasar webhook flow.',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
  })
  // DTO validation reuses PaymentMethod; the handler re-checks ONLINE_CARD.
  // @IsEnum is REQUIRED: without a class-validator decorator the global
  // ValidationPipe (whitelist + forbidNonWhitelisted) strips this property and
  // rejects every request with "property method should not exist", which makes
  // the reception manual-sale endpoint unreachable. Caught by the real-DB e2e.
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Free-form notes attached to the purchase', example: 'Walk-in sale, paid in cash' })
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}