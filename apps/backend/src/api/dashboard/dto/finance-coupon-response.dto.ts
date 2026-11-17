import { ApiProperty } from '@nestjs/swagger';
import { Prisma, type Coupon, type CouponRedemption } from '@prisma/client';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of the coupon routes in `dashboard/finance.controller.ts`.
 *
 * Documentation only — the classes are never instantiated. Every money column
 * is a `Prisma.Decimal` and serializes as a decimal string; `discountValue`
 * carries a raw percent for `PERCENTAGE` coupons and halalas for `FIXED` ones,
 * exactly as persisted.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000c1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** One persisted `Coupon` row (list, detail, create, update). */
export class CouponRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Coupon UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ description: 'Sequential coupon reference used in CPN-prefixed links', example: 1024 })
  ref!: number;

  @ApiProperty({ description: 'Unique coupon code', example: 'WELCOME10' })
  code!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description, or null', example: 'خصم الترحيب' })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description, or null', example: 'Welcome discount' })
  descriptionEn!: string | null;

  @ApiProperty({ description: 'Discount calculation type', enum: ['PERCENTAGE', 'FIXED'], example: 'PERCENTAGE' })
  discountType!: 'PERCENTAGE' | 'FIXED';

  @ApiProperty({ type: String, description: 'Discount value: percent for PERCENTAGE, halalas for FIXED (decimal string)', example: '10' })
  discountValue!: Prisma.Decimal;

  @ApiProperty({ type: Number, nullable: true, description: 'Total redemption limit, or null', example: 100 })
  maxUses!: number | null;

  @ApiProperty({ description: 'Redemptions recorded so far', example: 3 })
  usedCount!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Minimum order amount in halalas (decimal string), or null', example: '5000' })
  minOrderAmt!: Prisma.Decimal | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Expiry instant, or null for no expiry', example: ISO_EXAMPLE })
  expiresAt!: Date | null;

  @ApiProperty({ description: 'Whether the coupon is active', example: true })
  isActive!: boolean;

  @ApiProperty({ type: Number, nullable: true, description: 'Per-client redemption limit, or null', example: 1 })
  maxUsesPerUser!: number | null;

  @ApiProperty({ type: [String], description: 'Service UUIDs the coupon is restricted to (empty = unrestricted)', example: ['00000000-0000-4000-a000-0000000000c2'] })
  serviceIds!: string[];

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `GET /dashboard/finance/coupons` — the canonical `{ items, meta }` envelope. */
export class CouponListResponseDto {
  @ApiProperty({ type: [CouponRecordDto], description: 'Coupons on the requested page, newest first' })
  items!: CouponRecordDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata' })
  meta!: ListMetaDto;
}

/**
 * One persisted `CouponRedemption` row returned by
 * `POST /dashboard/finance/coupons/apply`. `discount` is the amount this coupon
 * actually subtracted, in halalas (decimal string).
 */
export class CouponRedemptionRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Redemption UUID', example: '00000000-0000-4000-a000-0000000000c3' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Coupon UUID', example: UUID_EXAMPLE })
  couponId!: string;

  @ApiProperty({ format: 'uuid', description: 'Invoice UUID', example: '00000000-0000-4000-a000-0000000000c4' })
  invoiceId!: string;

  @ApiProperty({ format: 'uuid', description: 'Redeeming client UUID', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string;

  @ApiProperty({ type: String, description: 'Discount actually subtracted in halalas (decimal string)', example: '2000' })
  discount!: Prisma.Decimal;

  @ApiProperty({ type: String, format: 'date-time', description: 'Redemption instant', example: ISO_EXAMPLE })
  redeemedAt!: Date;
}

// Compile-time guards: each row DTO must list exactly the Prisma columns.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
export const couponRecordDtoMatchesPrismaRow: Equal<keyof CouponRecordDto, keyof Coupon> = true;
export const couponRedemptionDtoMatchesPrismaRow: Equal<keyof CouponRedemptionRecordDto, keyof CouponRedemption> = true;
