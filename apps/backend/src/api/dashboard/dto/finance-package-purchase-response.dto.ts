import { ApiProperty } from '@nestjs/swagger';
import { PackagePurchaseStatus } from '@prisma/client';
import type { PackageOfferSnapshot } from '@sawaa/shared/types/package-family';

/**
 * Response shapes of the session-package purchase routes in
 * `dashboard/finance.controller.ts`.
 *
 * Documented routes here are the refund and the client purchase list.
 * `POST /dashboard/finance/package-purchases` is deliberately NOT documented in
 * this unit: its handler returns an untyped four-branch union whose `purchase`
 * slices carry index signatures (`[x: string]: unknown`) and whose `credits`
 * element type differs per branch. It cannot be pinned exactly without editing
 * `modules/finance/package-purchases/**`, which this unit is forbidden to touch.
 *
 * Money is integer halalas everywhere in these shapes because the handler maps
 * `Prisma.Decimal` columns with `Number()` before returning.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000d1';

/** One eligibility snapshot row attached to a purchased credit. */
export class PackagePurchaseCreditConstraintDto {
  @ApiProperty({ description: 'Eligibility dimension', enum: ['SERVICE', 'PRACTITIONER', 'DURATION', 'DELIVERY_TYPE'], example: 'SERVICE' })
  dimension!: 'SERVICE' | 'PRACTITIONER' | 'DURATION' | 'DELIVERY_TYPE';

  @ApiProperty({ description: 'Rule mode', enum: ['ANY', 'INCLUDE', 'EXCLUDE'], example: 'INCLUDE' })
  mode!: 'ANY' | 'INCLUDE' | 'EXCLUDE';

  @ApiProperty({ type: [String], description: 'Target ids; empty for ANY', example: ['00000000-0000-4000-a000-0000000000d2'] })
  targetIds!: string[];
}

/** Backend-computed availability for one purchased credit. */
export class PackagePurchaseCreditAvailabilityDto {
  @ApiProperty({ description: 'Whether the credit can be booked now', example: true })
  bookable!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Machine-readable reason when not bookable, or null', example: null })
  reason!: string | null;
}

/** One purchased credit bucket with resolved display names. */
export class PackagePurchaseCreditDto {
  @ApiProperty({ format: 'uuid', description: 'Credit UUID', example: '00000000-0000-4000-a000-0000000000d3' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned service UUID, or null on flexible credits', example: '00000000-0000-4000-a000-0000000000d4' })
  serviceId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned employee UUID, or null on flexible credits', example: null })
  employeeId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned duration-option UUID, or null on flexible credits', example: null })
  durationOptionId!: string | null;

  @ApiProperty({ description: 'Resolved Arabic service name (clinic name for hidden DIRECT services)', example: 'استشارة أسرية' })
  serviceNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved English service name, or null', example: 'Family consultation' })
  serviceNameEn!: string | null;

  @ApiProperty({ description: 'Resolved Arabic practitioner name', example: 'أحمد' })
  employeeNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved English practitioner name, or null', example: 'Ahmed' })
  employeeNameEn!: string | null;

  @ApiProperty({ description: 'Resolved Arabic duration label', example: '٤٥ دقيقة' })
  durationLabelAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved English duration label, or null', example: '45 min' })
  durationLabelEn!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Resolved duration in minutes, or null', example: 45 })
  durationMins!: number | null;

  @ApiProperty({ type: 'integer', description: 'Frozen unit price in integer halalas', example: 10000 })
  unitPriceSnapshot!: number;

  @ApiProperty({ description: 'Sessions bought', example: 4 })
  totalQuantity!: number;

  @ApiProperty({ description: 'Sessions delivered', example: 1 })
  usedQuantity!: number;

  @ApiProperty({ description: 'Sessions reserved by a future booking', example: 0 })
  reservedQuantity!: number;

  @ApiProperty({ description: 'totalQuantity − usedQuantity − reservedQuantity', example: 3 })
  remaining!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved category UUID, or null for flexible credits', example: '00000000-0000-4000-a000-0000000000d5' })
  categoryId!: string | null;

  @ApiProperty({ description: 'Resolved Arabic category name (empty when unresolved)', example: 'عيادة' })
  categoryNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved English category name, or null', example: 'Clinic' })
  categoryNameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Category booking mode, or null', enum: ['DIRECT', 'SERVICES'], example: 'SERVICES' })
  categoryBookingMode!: 'DIRECT' | 'SERVICES' | null;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved department UUID, or null', example: '00000000-0000-4000-a000-0000000000d6' })
  departmentId!: string | null;

  @ApiProperty({ description: 'Resolved Arabic department name (empty when unresolved)', example: 'قسم' })
  departmentNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Resolved English department name, or null', example: 'Department' })
  departmentNameEn!: string | null;

  @ApiProperty({ description: 'True when the service is active and the practitioner still offers it', example: true })
  serviceIsBookable!: boolean;

  @ApiProperty({ type: [PackagePurchaseCreditConstraintDto], description: 'Eligibility rules frozen at purchase time' })
  constraints!: PackagePurchaseCreditConstraintDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Purchase group UUID (grouped purchases), or null', example: null })
  purchaseGroupId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Session position inside its group, or null', example: null })
  sessionPosition!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Group label, or null', example: null })
  groupLabel!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Group sequence mode, or null', enum: ['ORDERED', 'UNORDERED'], example: null })
  sequenceMode!: 'ORDERED' | 'UNORDERED' | null;

  @ApiProperty({ type: String, nullable: true, description: 'Group this session depends on, or null', example: null })
  dependsOnGroupId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Frozen duration in minutes, or null', example: null })
  durationMinsSnapshot!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen delivery channel (IN_PERSON or ONLINE), or null', example: null })
  deliveryTypeSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen service name, or null', example: null })
  serviceNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen practitioner name, or null', example: null })
  employeeNameSnapshot!: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Frozen list price in integer halalas, or null', example: 20000 })
  listPriceSnapshot!: number | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Net amount paid for the credit in integer halalas, or null', example: 9000 })
  netValue!: number | null;

  @ApiProperty({ type: PackagePurchaseCreditAvailabilityDto, description: 'Backend-computed availability' })
  availability!: PackagePurchaseCreditAvailabilityDto;
}

/** One client package purchase with its credits (list response item). */
export class PackagePurchaseListRowDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false, description: 'Invoice UUID, or null; the handler interface declares it optional although the mapper always sets it', example: '00000000-0000-4000-a000-0000000000d7' })
  invoiceId?: string | null;

  @ApiProperty({ type: String, format: 'uuid', required: false, description: 'Branch UUID; the handler interface declares it optional although the mapper always sets it', example: '00000000-0000-4000-a000-0000000000d8' })
  branchId?: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, required: false, description: 'Package family UUID, or null; the handler interface declares it optional although the mapper always sets it', example: null })
  packageFamilyId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'Package purchase UUID', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Session-package UUID', example: '00000000-0000-4000-a000-0000000000d9' })
  packageId!: string;

  @ApiProperty({ description: 'Display Arabic package name (family name when offered from a family)', example: 'باقة الأسرة' })
  packageNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Display English package name, or null', example: 'Family package' })
  packageNameEn!: string | null;

  @ApiProperty({
    description: 'Frozen offer snapshot ({ familyId, familyNameAr, familyNameEn, optionNameAr, optionNameEn, sessionCount }), or null',
    type: 'object',
    nullable: true,
    properties: {
      familyId: { type: 'string', format: 'uuid' },
      familyNameAr: { type: 'string' },
      familyNameEn: { type: 'string', nullable: true },
      optionNameAr: { type: 'string' },
      optionNameEn: { type: 'string', nullable: true },
      sessionCount: { type: 'integer' },
    },
    example: { familyId: '00000000-0000-4000-a000-0000000000da', familyNameAr: 'باقة الأسرة', familyNameEn: 'Family package', optionNameAr: '٦ جلسات', optionNameEn: '6 sessions', sessionCount: 6 },
  })
  offerSnapshot!: PackageOfferSnapshot | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen family UUID, or null', example: null })
  familyId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen family Arabic name, or null', example: null })
  familyNameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen family English name, or null', example: null })
  familyNameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen option Arabic name, or null', example: null })
  optionNameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen option English name, or null', example: null })
  optionNameEn!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Frozen session count, or null', example: null })
  sessionCount!: number | null;

  @ApiProperty({ enum: PackagePurchaseStatus, enumName: 'PackagePurchaseStatus', example: 'ACTIVE' })
  status!: PackagePurchaseStatus;

  @ApiProperty({ type: 'integer', description: 'Frozen subtotal in integer halalas', example: 120000 })
  subtotalSnapshot!: number;

  @ApiProperty({ type: 'integer', description: 'Frozen discount in integer halalas', example: 0 })
  discountSnapshot!: number;

  @ApiProperty({ type: 'integer', description: 'Net amount paid in integer halalas', example: 120000 })
  amountPaid!: number;

  @ApiProperty({ type: 'integer', description: 'VAT on the purchase invoice in integer halalas (0 when VAT is off)', example: 0 })
  vatAmount!: number;

  @ApiProperty({ type: 'integer', description: 'Invoice total the client was charged, VAT-inclusive, in integer halalas', example: 120000 })
  totalCharged!: number;

  @ApiProperty({ type: 'integer', description: 'Cumulative refunded amount in integer halalas', example: 0 })
  refundAmount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Purchase instant', example: '2026-10-10T09:00:00.000Z' })
  paidAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Full-refund instant, or null', example: null })
  refundedAt!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Purchase notes, or null', example: null })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-10-10T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: [PackagePurchaseCreditDto], description: 'Purchased credit buckets' })
  credits!: PackagePurchaseCreditDto[];

  @ApiProperty({ description: 'Purchase model version', enum: ['LEGACY', 'GROUPED_V2'], example: 'LEGACY' })
  modelVersion!: 'LEGACY' | 'GROUPED_V2';
}

/**
 * `POST /dashboard/finance/package-purchases/:purchaseId/refund` — the outcome
 * of a manual (off-gateway) package refund. `status` is the purchase's status
 * after the refund: `REFUNDED` for a full refund, unchanged for a partial one.
 */
export class PackagePurchaseRefundResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Package purchase UUID', example: UUID_EXAMPLE })
  purchaseId!: string;

  @ApiProperty({ enum: PackagePurchaseStatus, enumName: 'PackagePurchaseStatus', example: 'REFUNDED' })
  status!: PackagePurchaseStatus;

  @ApiProperty({ type: 'integer', description: 'Amount refunded by this call in integer halalas', example: 50000 })
  refundAmount!: number;

  @ApiProperty({ type: 'integer', description: 'Cumulative refunded amount after this call in integer halalas', example: 50000 })
  totalRefunded!: number;

  @ApiProperty({ description: 'Whether this call completed a full refund', example: true })
  isFullRefund!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Full-refund instant, or null for a partial refund', example: '2026-10-11T09:00:00.000Z' })
  refundedAt!: Date | null;
}
