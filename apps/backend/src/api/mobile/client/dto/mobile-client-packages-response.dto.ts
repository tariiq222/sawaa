import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackagePurchaseStatus } from '@prisma/client';

/**
 * Swagger response shapes for `GET /mobile/client/packages/purchases[/:id]`.
 *
 * The handler (`ListClientPackagePurchasesHandler`) emits these rows and the
 * controller strips the internal `notes` field before sending. Documentation
 * only: the rows are produced by the domain handler and never serialized
 * through these classes.
 */

/** Snapshot eligibility rule of one package credit bucket. */
export class MobileClientPackageCreditConstraintDto {
  @ApiProperty({ enum: ['SERVICE', 'PRACTITIONER', 'DURATION', 'DELIVERY_TYPE'], description: 'Constraint dimension', example: 'SERVICE' })
  dimension!: 'SERVICE' | 'PRACTITIONER' | 'DURATION' | 'DELIVERY_TYPE';

  @ApiProperty({ enum: ['ANY', 'INCLUDE', 'EXCLUDE'], description: 'Constraint mode', example: 'INCLUDE' })
  mode!: 'ANY' | 'INCLUDE' | 'EXCLUDE';

  @ApiProperty({
    type: [String],
    description: 'Flattened target ids for the constraint; empty for ANY',
    example: ['00000000-0000-4000-a000-000000000010'],
  })
  targetIds!: string[];
}

/** Live bookability of a credit bucket. */
export class MobileClientPackageCreditAvailabilityDto {
  @ApiProperty({ description: 'Whether the credit can be booked right now', example: true })
  bookable!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Machine reason when not bookable, or null', example: null })
  reason!: string | null;
}

/** One decorated credit bucket of a package purchase. */
export class MobileClientPackageCreditDto {
  @ApiProperty({ format: 'uuid', description: 'Credit bucket UUID', example: '00000000-0000-4000-a000-000000000011' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned service UUID, or null for flexible credits', example: '00000000-0000-4000-a000-000000000005' })
  serviceId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned employee UUID, or null', example: '00000000-0000-4000-a000-000000000003' })
  employeeId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pinned duration option UUID, or null', example: null })
  durationOptionId!: string | null;

  @ApiProperty({ description: 'Service name (Arabic)', example: 'استشارة أسرية' })
  serviceNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Service name (English), or null', example: 'Family consultation' })
  serviceNameEn!: string | null;

  @ApiProperty({ description: 'Employee name (Arabic)', example: 'أحمد الغامدي' })
  employeeNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Employee name (English), or null', example: 'Ahmed Al-Ghamdi' })
  employeeNameEn!: string | null;

  @ApiProperty({ description: 'Duration label (Arabic)', example: '٦٠ دقيقة' })
  durationLabelAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Duration label (English), or null', example: '60 minutes' })
  durationLabelEn!: string | null;

  @ApiProperty({ type: 'number', nullable: true, description: 'Duration in minutes, or null', example: 60 })
  durationMins!: number | null;

  @ApiProperty({ type: 'number', nullable: true, description: 'Frozen duration in minutes, or null', example: 60 })
  durationMinsSnapshot!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen delivery channel, or null', example: 'IN_PERSON' })
  deliveryTypeSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen service name, or null', example: 'Family consultation' })
  serviceNameSnapshot!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Frozen employee name, or null', example: 'Ahmed Al-Ghamdi' })
  employeeNameSnapshot!: string | null;

  @ApiProperty({ type: 'number', nullable: true, description: 'Frozen list price in halalas, or null', example: 20000 })
  listPriceSnapshot!: number | null;

  @ApiProperty({ type: 'number', nullable: true, description: 'Net paid value for this credit in halalas, or null', example: 18000 })
  netValue!: number | null;

  @ApiProperty({ type: 'number', description: 'Unit price snapshot in halalas', example: 20000 })
  unitPriceSnapshot!: number;

  @ApiProperty({ type: 'integer', description: 'Total sessions in this bucket', example: 5 })
  totalQuantity!: number;

  @ApiProperty({ type: 'integer', description: 'Consumed sessions', example: 1 })
  usedQuantity!: number;

  @ApiProperty({ type: 'integer', description: 'Reserved (booked, not delivered) sessions', example: 1 })
  reservedQuantity!: number;

  @ApiProperty({ type: 'integer', description: 'Remaining sessions: total − used − reserved', example: 3 })
  remaining!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Service category UUID, or null', example: '00000000-0000-4000-a000-000000000020' })
  categoryId!: string | null;

  @ApiProperty({ description: 'Service category name (Arabic)', example: 'الإرشاد الأسري' })
  categoryNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Service category name (English), or null', example: 'Family counseling' })
  categoryNameEn!: string | null;

  @ApiProperty({ enum: ['DIRECT', 'SERVICES'], nullable: true, description: 'Category booking mode, or null', example: 'SERVICES' })
  categoryBookingMode!: 'DIRECT' | 'SERVICES' | null;

  @ApiProperty({ type: String, nullable: true, description: 'Department UUID, or null', example: null })
  departmentId!: string | null;

  @ApiProperty({ description: 'Department name (Arabic)', example: 'الإرشاد' })
  departmentNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Department name (English), or null', example: 'Counseling' })
  departmentNameEn!: string | null;

  @ApiProperty({ description: 'Whether the service/employee are still active and linked', example: true })
  serviceIsBookable!: boolean;

  @ApiProperty({ type: [MobileClientPackageCreditConstraintDto], description: 'Snapshot eligibility rules' })
  constraints!: MobileClientPackageCreditConstraintDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Purchase group UUID, or null', example: null })
  purchaseGroupId!: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Position within the purchase group, or null', example: null })
  sessionPosition!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Purchase group label, or null', example: null })
  groupLabel!: string | null;

  @ApiProperty({ enum: ['ORDERED', 'UNORDERED'], nullable: true, description: 'Sequence mode of the group, or null', example: null })
  sequenceMode!: 'ORDERED' | 'UNORDERED' | null;

  @ApiProperty({ type: String, nullable: true, description: 'Group UUID this bucket depends on, or null', example: null })
  dependsOnGroupId!: string | null;

  @ApiProperty({ type: MobileClientPackageCreditAvailabilityDto, description: 'Live bookability of the bucket' })
  availability!: MobileClientPackageCreditAvailabilityDto;
}

/** Immutable offer identity frozen at purchase time. */
export class MobileClientPackageOfferSnapshotDto {
  @ApiProperty({ description: 'Package family UUID', example: '00000000-0000-4000-a000-000000000030' })
  familyId!: string;

  @ApiProperty({ description: 'Family name (Arabic)', example: 'باقة أسرة' })
  familyNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Family name (English), or null', example: 'Family package' })
  familyNameEn!: string | null;

  @ApiProperty({ description: 'Option name (Arabic)', example: 'خمس جلسات' })
  optionNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Option name (English), or null', example: 'Five sessions' })
  optionNameEn!: string | null;

  @ApiProperty({ type: 'integer', description: 'Session count at purchase time', example: 5 })
  sessionCount!: number;
}

/** One decorated package purchase owned by the client (internal `notes` stripped). */
export class MobileClientPackagePurchaseDto {
  @ApiProperty({ format: 'uuid', description: 'Package purchase UUID', example: '00000000-0000-4000-a000-000000000040' })
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Purchase invoice UUID, or null (declared optional on the handler row type)', example: '00000000-0000-4000-a000-000000000008' })
  invoiceId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Branch UUID, or null (declared optional on the handler row type)', example: '00000000-0000-4000-a000-00000000000c' })
  branchId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Package family UUID from the offer snapshot, or null (declared optional on the handler row type)', example: '00000000-0000-4000-a000-000000000030' })
  packageFamilyId?: string | null;

  @ApiProperty({ format: 'uuid', description: 'Session package UUID', example: '00000000-0000-4000-a000-000000000031' })
  packageId!: string;

  @ApiProperty({ description: 'Package name (Arabic)', example: 'باقة خمس جلسات' })
  packageNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Package name (English), or null', example: 'Five-session package' })
  packageNameEn!: string | null;

  @ApiProperty({ type: MobileClientPackageOfferSnapshotDto, nullable: true, description: 'Frozen offer identity, or null for legacy purchases' })
  offerSnapshot!: MobileClientPackageOfferSnapshotDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package family UUID, or null', example: '00000000-0000-4000-a000-000000000030' })
  familyId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Family name (Arabic), or null', example: 'باقة أسرة' })
  familyNameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Family name (English), or null', example: 'Family package' })
  familyNameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Option name (Arabic), or null', example: 'خمس جلسات' })
  optionNameAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Option name (English), or null', example: 'Five sessions' })
  optionNameEn!: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Session count from the offer snapshot, or null', example: 5 })
  sessionCount!: number | null;

  @ApiProperty({ enum: PackagePurchaseStatus, enumName: 'PackagePurchaseStatus', description: 'Purchase status', example: 'ACTIVE' })
  status!: PackagePurchaseStatus;

  @ApiProperty({ type: 'number', description: 'Subtotal snapshot in halalas', example: 80000 })
  subtotalSnapshot!: number;

  @ApiProperty({ type: 'number', description: 'Discount snapshot in halalas', example: 0 })
  discountSnapshot!: number;

  @ApiProperty({ type: 'number', description: 'Net amount paid in halalas', example: 80000 })
  amountPaid!: number;

  @ApiProperty({ type: 'number', description: 'VAT on the purchase invoice in halalas; 0 when VAT is off', example: 0 })
  vatAmount!: number;

  @ApiProperty({ type: 'number', description: 'VAT-inclusive amount charged in halalas', example: 80000 })
  totalCharged!: number;

  @ApiProperty({ type: 'number', description: 'Refunded amount in halalas', example: 0 })
  refundAmount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Paid instant', example: '2026-05-20T09:00:00.000Z' })
  paidAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Refunded instant, or null', example: null })
  refundedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ enum: ['LEGACY', 'GROUPED_V2'], description: 'Credit model version', example: 'LEGACY' })
  modelVersion!: 'LEGACY' | 'GROUPED_V2';

  @ApiProperty({ type: [MobileClientPackageCreditDto], description: 'Credit buckets of this purchase' })
  credits!: MobileClientPackageCreditDto[];
}
