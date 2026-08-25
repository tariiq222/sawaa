import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Reception-side "collect a payment for this booking" use case.
 *
 * `method` is reused from the canonical `PaymentMethod` enum so the same
 * statistical label set (CASH / BANK_TRANSFER / MADA / TABBY) flows through
 * to ProcessPaymentHandler and into the Payment row. ONLINE_CARD and COUPON
 * are intentionally still enum-valid here (Swagger stays honest about every
 * PaymentMethod value) — the *handler* is the single source of truth that
 * rejects them with a BadRequestException before any composed handler runs,
 * because this endpoint represents a manual/statistical record only.
 */
export class CollectBookingPaymentDto {
  @ApiProperty({
    description:
      'Statistical payment label for the reception record. ONLINE_CARD and COUPON are rejected by the handler — manual collection only.',
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({
    description:
      'Amount to collect in integer halalas (1 SAR = 100). Omit to collect the full outstanding AFTER any discount. Must not exceed the outstanding balance — ProcessPaymentHandler enforces this.',
    example: 10000,
  })
  @IsOptional() @IsInt() @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'Manual discount to apply to the invoice subtotal BEFORE collection, in integer halalas (1 SAR = 100). Omit to skip discount. Requires discountReasonId when > 0.',
    example: 5000,
  })
  @IsOptional() @IsInt() @Min(0)
  discountAmt?: number;

  @ApiPropertyOptional({
    description:
      'Active DiscountReason UUID. Required by ApplyInvoiceDiscountHandler when discountAmt > 0.',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @IsOptional() @IsUUID()
  discountReasonId?: string;

  @ApiPropertyOptional({
    description: 'Free-text note stored on the invoice alongside the discount audit row.',
    example: 'موافقة المدير',
  })
  @IsOptional() @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key forwarded to ProcessPaymentHandler to dedupe dashboard retries.',
    example: 'collect-booking-2026-xyz',
  })
  @IsOptional() @IsString()
  idempotencyKey?: string;
}
