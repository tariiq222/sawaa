import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  DeliveryType,
  DiscountType,
  GroupSequenceMode,
  PackageConstraintDimension,
  PackageModelVersion,
  Prisma,
} from '@prisma/client';
import { ListMetaDto } from './people-response.dto';

/**
 * Response shapes of the dashboard session-package and package-family routes
 * (`organization-packages.controller.ts`, `package-families.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. Every property is traced to a Prisma include/select or to a value
 * computed by a decorator (`decorateGroupedPackage`, `decorateFamily`,
 * `ComputePackagePriceService`); `package-response.dto.spec.ts` pins each DTO to
 * those outputs with an exact type assertion.
 *
 * Two shapes are deliberately distinct:
 *  - write responses (POST/PATCH) return the raw persisted row: legacy rows
 *    carry `items`, grouped rows carry `groups` too, and neither is decorated
 *    with the computed price;
 *  - list/detail responses are decorated: `groups` is the editor projection and
 *    list rows carry the flattened price, while the detail carries `price`.
 * Both are documented rather than flattened into one permissive schema.
 */

const ISO_DATE_TIME = { type: String, format: 'date-time' } as const;
const DECIMAL_STRING = { type: String } as const;

// ── Items and constraints (raw persisted rows) ──────────────────────────────

/** One `SessionPackageItemConstraintTarget` row (`targets[]` of a constraint). */
export class PackageConstraintTargetRecordDto {
  @ApiProperty({ description: 'Constraint target row UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000070' })
  id!: string;

  @ApiProperty({ description: 'Owning constraint UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000060' })
  constraintId!: string;

  @ApiProperty({ description: 'Target value: service/employee/duration UUID, or a delivery type', example: '00000000-0000-4000-a000-000000000001' })
  targetId!: string;
}

/** One `SessionPackageItemConstraint` row with its resolved targets. */
export class PackageItemConstraintRecordDto {
  @ApiProperty({ description: 'Constraint row UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000060' })
  id!: string;

  @ApiProperty({ description: 'Owning package item UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000050' })
  itemId!: string;

  @ApiProperty({ description: 'Constrained dimension', enum: PackageConstraintDimension, example: 'PRACTITIONER' })
  dimension!: PackageConstraintDimension;

  @ApiProperty({ description: 'Matching mode', enum: ['ANY', 'INCLUDE', 'EXCLUDE'], example: 'INCLUDE' })
  mode!: 'ANY' | 'INCLUDE' | 'EXCLUDE';

  @ApiProperty({ type: [PackageConstraintTargetRecordDto], description: 'Target values for INCLUDE/EXCLUDE (empty for ANY)' })
  targets!: PackageConstraintTargetRecordDto[];
}

/** A raw `SessionPackageItem` row with its constraints (the persisted item). */
export class PackageItemRecordDto {
  @ApiProperty({ description: 'Package item UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000050' })
  id!: string;

  @ApiProperty({ description: 'Owning package UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  packageId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Owning group UUID for GROUPED_V2 items', example: null })
  groupId!: string | null;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Zero-based session position inside a GROUPED_V2 group', example: null })
  sessionPosition!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'Legacy single-service UUID (null for rule-based items)', example: null })
  serviceId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Legacy single-practitioner UUID (null for rule-based items)', example: null })
  employeeId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Legacy single duration-option UUID (null for rule-based items)', example: null })
  durationOptionId!: string | null;

  @ApiProperty({ ...DECIMAL_STRING, nullable: true, description: 'Fixed prepaid unit price in integer halalas, decimal string; null = derive', example: '25000' })
  unitPrice!: Prisma.Decimal | null;

  @ApiProperty({ type: String, nullable: true, description: 'Optional display label', example: null })
  label!: string | null;

  @ApiProperty({ type: 'integer', description: 'Paid session count', example: 4 })
  paidQuantity!: number;

  @ApiProperty({ type: 'integer', description: 'Free bonus session count', example: 1 })
  freeQuantity!: number;

  @ApiProperty({ type: String, nullable: true, enum: ['PERCENTAGE', 'FIXED'], description: 'Per-item discount type; null = no discount', example: null })
  discountType!: DiscountType | null;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Per-item discount value (0-100 for PERCENTAGE, integer halalas for FIXED), decimal string', example: '0' })
  discountValue!: Prisma.Decimal;

  @ApiProperty({ type: 'integer', description: 'Display order within the package', example: 0 })
  sortOrder!: number;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: [PackageItemConstraintRecordDto], description: 'Eligibility constraints persisted for this item' })
  constraints!: PackageItemConstraintRecordDto[];
}

// ── Decorated editor projection (list and detail responses) ─────────────────

/** One session of a decorated GROUPED_V2 group (`decorateGroupedPackage`). */
export class PackageGroupSessionReadDto {
  @ApiProperty({ description: 'Stable editor key (the persisted item UUID)', example: '00000000-0000-4000-a000-000000000050' })
  key!: string;

  @ApiProperty({ type: 'integer', description: 'Zero-based session position inside the group', example: 0 })
  position!: number;

  @ApiProperty({ description: 'Service duration-option UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000003' })
  durationOptionId!: string;

  @ApiProperty({ description: 'Delivery channel', enum: DeliveryType, example: 'IN_PERSON' })
  deliveryType!: DeliveryType;

  @ApiProperty({ type: 'integer', description: 'Session price override in integer halalas', example: 30000 })
  unitPrice!: number;
}

/** One decorated GROUPED_V2 group (`decorateGroupedPackage`). */
export class PackageGroupReadDto {
  @ApiProperty({ description: 'Stable editor key', example: 'group-1' })
  key!: string;

  @ApiPropertyOptional({ description: 'Optional group label; omitted when the stored label is null', example: 'المرحلة الأولى' })
  label?: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  serviceId!: string;

  @ApiProperty({ description: 'Practitioner UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000002' })
  employeeId!: string;

  @ApiProperty({ description: 'Session sequence behaviour', enum: GroupSequenceMode, example: 'ORDERED' })
  sequenceMode!: GroupSequenceMode;

  @ApiProperty({ type: String, nullable: true, description: 'Key of the group that must complete first, or null', example: null })
  dependsOnGroupKey!: string | null;

  @ApiProperty({ type: [PackageGroupSessionReadDto], description: 'Sessions in position order' })
  sessions!: PackageGroupSessionReadDto[];
}

// ── Global discount (discriminated union) ───────────────────────────────────

/** No package-wide discount. */
export class PackageNoGlobalDiscountDto {
  @ApiProperty({ description: 'No discount', enum: ['NONE'], example: 'NONE' })
  type!: 'NONE';

  @ApiProperty({ description: 'Always zero for NONE', enum: [0], example: 0 })
  value!: 0;
}

/** Package-wide percentage discount. */
export class PackagePercentageGlobalDiscountDto {
  @ApiProperty({ description: 'Percentage discount', enum: ['PERCENTAGE'], example: 'PERCENTAGE' })
  type!: 'PERCENTAGE';

  @ApiProperty({ description: 'Percentage from 0 to 100', minimum: 0, example: 10 })
  value!: number;
}

/** Package-wide fixed discount in integer halalas. */
export class PackageFixedGlobalDiscountDto {
  @ApiProperty({ description: 'Fixed discount', enum: ['FIXED'], example: 'FIXED' })
  type!: 'FIXED';

  @ApiProperty({ description: 'Fixed amount in integer halalas', minimum: 0, example: 5000 })
  value!: number;
}

/** Package-wide discount; `type` discriminates the three shapes. */
export type PackageGlobalDiscount =
  | PackageNoGlobalDiscountDto
  | PackagePercentageGlobalDiscountDto
  | PackageFixedGlobalDiscountDto;

export const PACKAGE_GLOBAL_DISCOUNT_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(PackageNoGlobalDiscountDto) },
    { $ref: getSchemaPath(PackagePercentageGlobalDiscountDto) },
    { $ref: getSchemaPath(PackageFixedGlobalDiscountDto) },
  ],
};

// ── Raw persisted package row (write responses) ─────────────────────────────

/** Scalar columns of a `SessionPackage` row. */
export class PackageRawRecordDto {
  @ApiProperty({ description: 'Package UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Owning package family UUID, or null for a standalone package', example: null })
  familyId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Package-level practitioner UUID; null for a general package', example: null })
  ownerEmployeeId!: string | null;

  @ApiProperty({ description: 'Catalog model version', enum: PackageModelVersion, example: 'LEGACY' })
  modelVersion!: PackageModelVersion;

  @ApiProperty({ description: 'Arabic package name', example: 'أربع جلسات استشارة' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English package name', example: 'Four consultation sessions' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Stored image reference, or null', example: null })
  imageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Icon name, or null', example: 'package' })
  iconName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Icon background colour (hex), or null', example: '#FFD8A8' })
  iconBgColor!: string | null;

  @ApiProperty({ description: 'Package-level discount type (deprecated; per-item discounts are authoritative)', enum: DiscountType, example: 'PERCENTAGE' })
  discountType!: DiscountType;

  @ApiProperty({ ...DECIMAL_STRING, description: 'Package-level discount value (deprecated), decimal string', example: '0' })
  discountValue!: Prisma.Decimal;

  @ApiProperty({ description: 'Whether the package is selectable', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether the package is visible in the public catalog', example: false })
  isPublic!: boolean;

  @ApiProperty({ type: 'integer', description: 'Catalog ordering', example: 0 })
  sortOrder!: number;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Soft-archive instant, or null while the package is live', example: null })
  archivedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;
}

/**
 * POST / PATCH response for a LEGACY package: the raw persisted row plus its
 * items. No `groups` key and no computed price — the write handlers return the
 * Prisma row unchanged.
 */
export class PackageLegacyWriteResponseDto extends PackageRawRecordDto {
  @ApiProperty({ type: [PackageItemRecordDto], description: 'Persisted legacy items' })
  items!: PackageItemRecordDto[];
}

/** A raw `SessionPackageGroup` row with its template items. */
export class PackageRawGroupRecordDto {
  @ApiProperty({ description: 'Group row UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000061' })
  id!: string;

  @ApiProperty({ description: 'Owning package UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  packageId!: string;

  @ApiProperty({ description: 'Stable editor key', example: 'group-1' })
  key!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Optional group label', example: null })
  label!: string | null;

  @ApiProperty({ description: 'Service UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' })
  serviceId!: string;

  @ApiProperty({ description: 'Practitioner UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000002' })
  employeeId!: string;

  @ApiProperty({ description: 'Session sequence behaviour', enum: GroupSequenceMode, example: 'ORDERED' })
  sequenceMode!: GroupSequenceMode;

  @ApiProperty({ type: String, nullable: true, description: 'Group that must complete first, or null', example: null })
  dependsOnGroupId!: string | null;

  @ApiProperty({ type: 'integer', description: 'Group ordering', example: 0 })
  sortOrder!: number;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: [PackageItemRecordDto], description: 'Persisted template items of this group' })
  items!: PackageItemRecordDto[];
}

/**
 * POST / PATCH response for a GROUPED_V2 package: the raw persisted row with
 * its groups and items. The editor projection (`PackageGroupReadDto`) is only
 * produced by the read handlers.
 */
export class PackageGroupedWriteResponseDto extends PackageRawRecordDto {
  @ApiProperty({ type: [PackageItemRecordDto], description: 'Persisted template items' })
  items!: PackageItemRecordDto[];

  @ApiProperty({ type: [PackageRawGroupRecordDto], description: 'Persisted groups with their items' })
  groups!: PackageRawGroupRecordDto[];
}

/** POST/PATCH response: depends on the package model version that was written. */
export type PackageWriteResponseDto =
  | PackageLegacyWriteResponseDto
  | PackageGroupedWriteResponseDto;

export const PACKAGE_WRITE_RESPONSE_SCHEMA = {
  oneOf: [
    { $ref: getSchemaPath(PackageLegacyWriteResponseDto) },
    { $ref: getSchemaPath(PackageGroupedWriteResponseDto) },
  ],
};

// ── Price breakdown ────────────────────────────────────────────────────────

/** One per-item unit price (`PackagePriceResult.itemUnitPrices`). */
export class PackageItemUnitPriceDto {
  @ApiProperty({ type: String, nullable: true, description: 'Duration-option UUID, or null for a rule-based item', example: null })
  durationOptionId!: string | null;

  @ApiProperty({ type: 'integer', description: 'Resolved unit price in integer halalas', example: 30000 })
  unitPrice!: number;
}

/** One line of the computed price breakdown (`PackagePriceResult.lines`). */
export class PackagePriceLineDto {
  @ApiProperty({ type: String, nullable: true, description: 'Duration-option UUID, or null for a rule-based item', example: null })
  durationOptionId!: string | null;

  @ApiProperty({ type: 'integer', description: 'Per-session price in integer halalas', example: 30000 })
  unitPrice!: number;

  @ApiProperty({ type: 'integer', description: '(paid + free) × unitPrice in integer halalas', example: 150000 })
  fullValue!: number;

  @ApiProperty({ type: 'integer', description: 'free × unitPrice in integer halalas', example: 30000 })
  freeValue!: number;

  @ApiProperty({ type: 'integer', description: 'paid × unitPrice before the item discount', example: 120000 })
  payable!: number;

  @ApiProperty({ type: 'integer', description: 'Item discount in integer halalas', example: 12000 })
  discountAmount!: number;

  @ApiProperty({ type: 'integer', description: 'payable − discountAmount in integer halalas', example: 108000 })
  net!: number;
}

/** Canonical computed price (`ComputePackagePriceService` result). */
export class PackagePriceBreakdownDto {
  @ApiProperty({ type: 'integer', description: 'Σ payable in integer halalas', example: 120000 })
  subtotal!: number;

  @ApiProperty({ type: 'integer', description: 'Σ per-item discount in integer halalas', example: 12000 })
  discountAmount!: number;

  @ApiProperty({ type: 'integer', description: 'max(0, subtotal − discountAmount) in integer halalas', example: 108000 })
  finalPrice!: number;

  @ApiProperty({ type: 'integer', description: 'Σ full value including free sessions, in integer halalas', example: 150000 })
  fullValue!: number;

  @ApiProperty({ type: 'integer', description: 'Σ value of free sessions in integer halalas', example: 30000 })
  freeValue!: number;

  @ApiProperty({ type: [PackageItemUnitPriceDto], description: 'Per-item unit prices in item order' })
  itemUnitPrices!: PackageItemUnitPriceDto[];

  @ApiProperty({ type: [PackagePriceLineDto], description: 'Per-item price lines in item order' })
  lines!: PackagePriceLineDto[];
}

// ── Decorated read rows ────────────────────────────────────────────────────

/** A session package decorated for the dashboard editor (read projection). */
export class PackageRecordDto extends PackageRawRecordDto {
  @ApiProperty({ type: [PackageItemRecordDto], description: 'Persisted items with their constraints' })
  items!: PackageItemRecordDto[];

  @ApiProperty({ type: [PackageGroupReadDto], description: 'Editor projection of the groups (empty for LEGACY packages)' })
  groups!: PackageGroupReadDto[];

  @ApiProperty({ ...PACKAGE_GLOBAL_DISCOUNT_SCHEMA, description: 'Package-wide discount derived from the stored columns' })
  globalDiscount!: PackageGlobalDiscount;
}

/** One row of GET /dashboard/organization/packages (price flattened onto the row). */
export class PackageListRowDto extends PackageRecordDto {
  @ApiProperty({ type: 'integer', description: 'Computed subtotal in integer halalas', example: 120000 })
  subtotal!: number;

  @ApiProperty({ type: 'integer', description: 'Computed discount total in integer halalas', example: 12000 })
  discountAmount!: number;

  @ApiProperty({ type: 'integer', description: 'Computed final price in integer halalas', example: 108000 })
  finalPrice!: number;

  @ApiProperty({ type: 'integer', description: 'Computed full value including free sessions, in integer halalas', example: 150000 })
  fullValue!: number;

  @ApiProperty({ type: 'integer', description: 'Computed value of free sessions in integer halalas', example: 30000 })
  freeValue!: number;

  @ApiProperty({ description: 'VAT rate the sale invoice adds on top of finalPrice (fraction; 0 unless enabled)', example: 0 })
  vatRate!: number;
}

/** GET /dashboard/organization/packages (paginated). */
export class PaginatedPackagesDto {
  @ApiProperty({ type: [PackageListRowDto], description: 'Packages on the requested page' })
  items!: PackageListRowDto[];

  @ApiProperty({ type: ListMetaDto, description: 'Pagination metadata for the full result set' })
  meta!: ListMetaDto;
}

/** GET /dashboard/organization/packages/:packageId. */
export class PackageDetailResponseDto extends PackageRecordDto {
  @ApiProperty({ type: PackagePriceBreakdownDto, description: 'Canonical computed price breakdown' })
  price!: PackagePriceBreakdownDto;
}

// ── Package families ──────────────────────────────────────────────────────

/** One session of a display-only family group label. */
export class PackageDisplaySessionDto {
  @ApiProperty({ type: 'integer', description: 'Zero-based session position inside the group', example: 0 })
  position!: number;

  @ApiProperty({ type: 'integer', description: 'Duration in minutes', example: 60 })
  durationMins!: number;

  @ApiProperty({ description: 'Delivery channel', enum: DeliveryType, example: 'IN_PERSON' })
  deliveryType!: DeliveryType;
}

/** Read-only catalog labels for a family option group (never written back). */
export class PackageDisplayGroupDto {
  @ApiProperty({ description: 'Stable editor key', example: 'group-1' })
  key!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Group label, or null', example: null })
  label!: string | null;

  @ApiProperty({ description: 'Service display name (Arabic)', example: 'استشارة أسرية' })
  serviceNameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Service display name (English)', example: 'Family consultation' })
  serviceNameEn!: string | null;

  @ApiProperty({ description: 'Practitioner display name', example: 'د. خالد' })
  employeeName!: string;

  @ApiProperty({ type: [PackageDisplaySessionDto], description: 'Display sessions in position order' })
  sessions!: PackageDisplaySessionDto[];
}

/** One sellable option of a package family (`decorateFamilyOption`). */
export class PackageFamilyOptionResponseDto {
  @ApiProperty({ description: 'Option (session package) UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000040' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Owning family UUID, or null', example: '00000000-0000-4000-a000-000000000030' })
  familyId!: string | null;

  @ApiProperty({ description: 'Arabic option name', example: '5 جلسات' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English option name', example: '5 sessions' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Signed image URL, or null', example: null })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Whether the option can be purchased', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether the option is shown publicly', example: false })
  isPublic!: boolean;

  @ApiProperty({ type: 'integer', description: 'Catalog ordering', example: 0 })
  sortOrder!: number;

  @ApiProperty({ description: 'Stored model version', enum: PackageModelVersion, example: 'GROUPED_V2' })
  modelVersion!: PackageModelVersion;

  @ApiProperty({ type: [PackageGroupReadDto], description: 'Editor projection of the option groups' })
  groups!: PackageGroupReadDto[];

  @ApiProperty({ ...PACKAGE_GLOBAL_DISCOUNT_SCHEMA, description: 'Option-wide discount derived from the stored columns' })
  globalDiscount!: PackageGlobalDiscount;

  @ApiPropertyOptional({ type: [PackageDisplayGroupDto], description: 'Read-only display labels; omitted when they cannot be resolved' })
  displayGroups?: PackageDisplayGroupDto[];

  @ApiProperty({ type: 'integer', description: 'Total sessions (paid + free, or grouped session count)', example: 5 })
  sessionCount!: number;

  @ApiProperty({ type: PackagePriceBreakdownDto, description: 'Canonical computed price for this option' })
  price!: PackagePriceBreakdownDto;
}

/** GET/list/create/update response of a package family (`decorateFamily`). */
export class PackageFamilyResponseDto {
  @ApiProperty({ description: 'Family UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000030' })
  id!: string;

  @ApiProperty({ description: 'Arabic family name', example: 'باقة الاستشارة' })
  nameAr!: string;

  @ApiProperty({ type: String, nullable: true, description: 'English family name', example: 'Consultation pack' })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Arabic description', example: null })
  descriptionAr!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'English description', example: null })
  descriptionEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Signed image URL, or null', example: null })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Whether the family is active', example: true })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether the family is public', example: false })
  isPublic!: boolean;

  @ApiProperty({ type: 'integer', description: 'Catalog ordering', example: 0 })
  sortOrder!: number;

  @ApiProperty({ ...ISO_DATE_TIME, nullable: true, description: 'Archive instant, or null while the family is live', example: null })
  archivedAt!: Date | null;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Creation instant', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ ...ISO_DATE_TIME, description: 'Last update instant', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ description: 'True when the row is a standalone package projected into the family shape', example: false })
  isStandalone!: boolean;

  @ApiProperty({ type: [PackageFamilyOptionResponseDto], description: 'Sellable options of the family' })
  options!: PackageFamilyOptionResponseDto[];
}

/** One row of GET /dashboard/organization/package-families (family + VAT rate). */
export class PackageFamilyWithVatResponseDto extends PackageFamilyResponseDto {
  @ApiProperty({ description: 'VAT rate the sale invoice adds on top of option prices (fraction; 0 unless enabled)', example: 0 })
  vatRate!: number;
}
