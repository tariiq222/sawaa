import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { ComputePackagePriceService } from '../../src/modules/org-experience/compute-package-price.service';
import { resolvePackageGroupOfferings } from '../../src/modules/org-experience/session-packages/package-group-offering.helper';
import type { PackageGroupInputLike } from '../../src/modules/org-experience/session-packages/package-group-offering.helper';

export type ConversionClassification =
  | 'READY_DRAFT'
  | 'NEEDS_OFFERING_SELECTION'
  | 'INCONSISTENT';

export type PurchaseProtection = 'LEGACY_PURCHASE_UNCHANGED';

export interface LegacyConstraint {
  dimension: string;
  mode: string;
  targets?: Array<{ targetId: string }>;
}

export interface LegacyItem {
  id: string;
  sortOrder?: number | null;
  serviceId?: string | null;
  employeeId?: string | null;
  durationOptionId?: string | null;
  unitPrice?: unknown;
  paidQuantity: number;
  freeQuantity?: number | null;
  discountType?: string | null;
  discountValue?: unknown;
  constraints?: LegacyConstraint[];
}

export interface LegacyPackage {
  id: string;
  modelVersion?: string;
  ownerEmployeeId?: string | null;
  nameAr: string;
  nameEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  imageUrl?: string | null;
  iconName?: string | null;
  iconBgColor?: string | null;
  discountType?: string | null;
  discountValue?: unknown;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt: Date;
  items: LegacyItem[];
}

export interface OfferingEvidence {
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  serviceExists: boolean;
  employeeExists: boolean;
  employeeServiceExists: boolean;
  employeeServiceId?: string;
  useCustomPricing?: boolean;
  disabledDeliveryTypes?: string[];
  durationExists: boolean;
  durationServiceId?: string;
  durationMins?: number;
  durationDeliveryType?: string;
  durationEmployeeServiceId?: string | null;
  serviceDeliveryTypes?: string[];
  serviceCategoryActive?: boolean;
  serviceIsHidden?: boolean;
  serviceCategoryBookingMode?: string | null;
}

export interface ResolvedLegacyItem {
  sourceItemId: string;
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  deliveryType: 'IN_PERSON' | 'ONLINE';
  durationMins: number;
  unitPrice: number;
  paidQuantity: number;
  freeQuantity: number;
  net: number;
}

export interface DraftSessionPreview {
  position: number;
  sourceItemId: string;
  durationOptionId: string;
  deliveryType: 'IN_PERSON' | 'ONLINE';
  unitPrice: number;
  free: boolean;
}

export interface DraftGroupPreview {
  key: string;
  serviceId: string;
  employeeId: string;
  sequenceMode: 'UNORDERED';
  dependsOnGroupKey: null;
  sessions: DraftSessionPreview[];
}

export interface ConversionBeforeSummary {
  modelVersion: string;
  itemCount: number;
  paidRights: number;
  freeRights: number;
  totalRights: number;
  subtotal: number | null;
  discountAmount: number | null;
  finalPrice: number | null;
  purchasedCount: number;
}

export interface ConversionAfterPreview {
  modelVersion: 'GROUPED_V2';
  globalDiscount: { type: 'NONE'; value: 0 };
  subtotal: number;
  finalPrice: number;
  totalRights: number;
  groups: DraftGroupPreview[];
}

export interface ProtectedConversionMapping {
  sourcePackageId: string;
  sourceRevision: string;
  classification: ConversionClassification;
  reasons: string[];
  before: ConversionBeforeSummary;
  after: ConversionAfterPreview | null;
  purchasedRights: {
    classification: PurchaseProtection;
    purchaseCount: number;
    creditCount: number;
  };
}

export interface PackageConversionManifest {
  version: 1;
  database: string;
  schema: string;
  generatedAt: string;
  mappings: ProtectedConversionMapping[];
  aggregate: {
    packageCount: number;
    readyDrafts: number;
    needsOfferingSelection: number;
    inconsistent: number;
    purchasedRightsUnchanged: number;
  };
}

export interface LegacyPackagePriceLine {
  unitPrice: number;
  net: number;
}

export interface LegacyPackagePrice {
  subtotal: number;
  discountAmount: number;
  finalPrice: number;
  lines: LegacyPackagePriceLine[];
}

export interface AuditBuildOptions {
  offerings?: Map<string, OfferingEvidence>;
  prices?: Map<string, LegacyPackagePrice>;
}

const DELIVERY_TYPES = new Set(['IN_PERSON', 'ONLINE']);

function scalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toString' in value) return String((value as { toString(): string }).toString());
  return value as string | number | boolean;
}

/** Canonical JSON keeps source revisions stable while preserving ordered arrays. */
export function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalize(entry)] as const);
  return Object.fromEntries(entries);
}

export function sourceDefinition(pkg: LegacyPackage): unknown {
  return {
    id: pkg.id,
    modelVersion: pkg.modelVersion ?? 'LEGACY',
    ownerEmployeeId: pkg.ownerEmployeeId ?? null,
    nameAr: pkg.nameAr,
    nameEn: pkg.nameEn ?? null,
    descriptionAr: pkg.descriptionAr ?? null,
    descriptionEn: pkg.descriptionEn ?? null,
    imageUrl: pkg.imageUrl ?? null,
    iconName: pkg.iconName ?? null,
    iconBgColor: pkg.iconBgColor ?? null,
    discountType: pkg.discountType ?? null,
    discountValue: scalar(pkg.discountValue),
    isActive: pkg.isActive ?? true,
    isPublic: pkg.isPublic ?? false,
    sortOrder: pkg.sortOrder ?? 0,
    archivedAt: pkg.archivedAt ?? null,
    createdAt: pkg.createdAt ?? null,
    updatedAt: pkg.updatedAt,
    items: [...pkg.items].sort(itemOrder).map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder ?? 0,
      serviceId: item.serviceId ?? null,
      employeeId: item.employeeId ?? null,
      durationOptionId: item.durationOptionId ?? null,
      unitPrice: scalar(item.unitPrice),
      paidQuantity: item.paidQuantity,
      freeQuantity: item.freeQuantity ?? 0,
      discountType: item.discountType ?? null,
      discountValue: scalar(item.discountValue),
      constraints: [...(item.constraints ?? [])].sort((left, right) => left.dimension.localeCompare(right.dimension)).map((constraint) => ({
        dimension: constraint.dimension,
        mode: constraint.mode,
        targets: [...(constraint.targets ?? [])].sort((left, right) => left.targetId.localeCompare(right.targetId)).map((target) => ({ targetId: target.targetId })),
      })),
    })),
  };
}

export function sourceRevision(pkg: LegacyPackage): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(sourceDefinition(pkg))))
    .digest('hex');
}

function itemOrder(left: LegacyItem, right: LegacyItem): number {
  return (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id.localeCompare(right.id);
}

function reasonFor(item: LegacyItem, evidence: OfferingEvidence | undefined): { classification: ConversionClassification; reasons: string[] } {
  const reasons: string[] = [];
  if (!Number.isSafeInteger(item.paidQuantity) || item.paidQuantity < 0 || item.paidQuantity > 100_000 || !Number.isSafeInteger(item.freeQuantity ?? 0) || (item.freeQuantity ?? 0) < 0 || (item.freeQuantity ?? 0) > 100_000 || item.paidQuantity + (item.freeQuantity ?? 0) < 1) {
    reasons.push('INVALID_QUANTITY');
  }
  const constraints = item.constraints ?? [];
  const byDimension = new Map<string, LegacyConstraint>();
  for (const constraint of constraints) {
    if (byDimension.has(constraint.dimension)) reasons.push(`DUPLICATE_CONSTRAINT:${constraint.dimension}`);
    byDimension.set(constraint.dimension, constraint);
    const targets = constraint.targets ?? [];
    if (constraint.mode === 'ANY' && targets.length > 0) reasons.push(`ANY_HAS_TARGETS:${constraint.dimension}`);
    if (constraint.mode !== 'ANY' && targets.length === 0) reasons.push(`CONSTRAINT_HAS_NO_TARGETS:${constraint.dimension}`);
  }
  if (reasons.length > 0) return { classification: 'INCONSISTENT', reasons };

  const scalarValues: Array<[string, string | null | undefined]> = [
    ['SERVICE', item.serviceId],
    ['PRACTITIONER', item.employeeId],
    ['DURATION', item.durationOptionId],
  ];
  for (const [dimension, value] of scalarValues) {
    const constraint = byDimension.get(dimension);
    if (constraint?.mode === 'INCLUDE' && value && !(constraint.targets ?? []).some((target) => target.targetId === value)) {
      reasons.push(`SCALAR_CONSTRAINT_MISMATCH:${dimension}`);
    }
  }
  if (reasons.length > 0) return { classification: 'INCONSISTENT', reasons };

  const knownDimensions = new Set(['SERVICE', 'PRACTITIONER', 'DURATION', 'DELIVERY_TYPE']);
  const knownModes = new Set(['ANY', 'INCLUDE', 'EXCLUDE']);
  if (constraints.some((constraint) => !knownDimensions.has(constraint.dimension) || !knownModes.has(constraint.mode))) {
    reasons.push('UNKNOWN_CONSTRAINT');
  }
  if (reasons.length > 0) return { classification: 'INCONSISTENT', reasons };

  const ambiguous = constraints.some((constraint) => constraint.mode === 'ANY' || constraint.mode === 'EXCLUDE');
  const delivery = byDimension.get('DELIVERY_TYPE');
  if (delivery && delivery.mode === 'INCLUDE' && (delivery.targets ?? []).length !== 1) {
    reasons.push('MULTIPLE_DELIVERY_OPTIONS');
  }
  if (ambiguous) reasons.push('FLEXIBLE_OR_EXCLUSION_CONSTRAINT');
  if (!item.serviceId || !item.employeeId || !item.durationOptionId) reasons.push('MISSING_CONCRETE_OFFERING');
  if (reasons.length > 0) return { classification: 'NEEDS_OFFERING_SELECTION', reasons };

  if (!evidence) return { classification: 'INCONSISTENT', reasons: ['OFFERING_NOT_RESOLVED'] };
  if (!evidence.serviceExists) reasons.push('MISSING_SERVICE_REFERENCE');
  if (!evidence.employeeExists) reasons.push('MISSING_PRACTITIONER_REFERENCE');
  if (!evidence.employeeServiceExists) reasons.push('MISSING_EMPLOYEE_SERVICE_REFERENCE');
  if (!evidence.durationExists || !Number.isInteger(evidence.durationMins) || (evidence.durationMins ?? 0) <= 0) {
    reasons.push('MISSING_OR_INVALID_DURATION');
  }
  if (evidence.durationServiceId && evidence.durationServiceId !== evidence.serviceId) reasons.push('DURATION_SERVICE_MISMATCH');
  if (!evidence.durationDeliveryType || !DELIVERY_TYPES.has(evidence.durationDeliveryType)) reasons.push('MISSING_OR_INVALID_DELIVERY');
  if (evidence.serviceCategoryActive === false) reasons.push('INACTIVE_SERVICE_CATEGORY');
  if (evidence.serviceIsHidden && evidence.serviceCategoryBookingMode !== 'DIRECT') reasons.push('HIDDEN_SERVICE_NOT_DIRECT');
  if (evidence.useCustomPricing && evidence.durationEmployeeServiceId !== evidence.employeeServiceId) reasons.push('DURATION_NOT_OFFERED_BY_PRACTITIONER');
  if (!evidence.useCustomPricing && evidence.durationEmployeeServiceId != null) reasons.push('DURATION_HAS_FOREIGN_PRACTITIONER_OWNER');
  if ((evidence.disabledDeliveryTypes ?? []).includes(evidence.durationDeliveryType ?? '')) reasons.push('PRACTITIONER_DISABLED_DELIVERY');
  if (evidence.serviceDeliveryTypes && evidence.serviceDeliveryTypes.length > 0 && !evidence.serviceDeliveryTypes.includes(evidence.durationDeliveryType ?? '')) {
    reasons.push('SERVICE_DELIVERY_NOT_ALLOWED');
  }
  const deliveryTarget = delivery?.mode === 'INCLUDE' ? delivery.targets?.[0]?.targetId : undefined;
  if (deliveryTarget && deliveryTarget !== evidence.durationDeliveryType) reasons.push('DELIVERY_CONSTRAINT_MISMATCH');
  if (reasons.length > 0) return { classification: 'INCONSISTENT', reasons };
  return { classification: 'READY_DRAFT', reasons: [] };
}

export function classifyLegacyItem(item: LegacyItem, evidence?: OfferingEvidence): { classification: ConversionClassification; reasons: string[] } {
  return reasonFor(item, evidence);
}

function numericValue(value: unknown): number {
  const parsed = Number(scalar(value));
  return parsed;
}

function distribute(total: number, quantity: number): number[] {
  if (quantity <= 0 || quantity > 100_000 || !Number.isSafeInteger(quantity) || !Number.isSafeInteger(total) || total < 0) return [];
  const base = Math.floor(total / quantity);
  let remainder = total - base * quantity;
  return Array.from({ length: quantity }, () => {
    const amount = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return amount;
  });
}

export function buildDraftPreview(
  pkg: LegacyPackage,
  prices: LegacyPackagePrice,
  offerings: Map<string, OfferingEvidence>,
): ConversionAfterPreview {
  const groups = new Map<string, DraftGroupPreview>();
  const linesByItem = new Map(pkg.items.map((item, index) => [item.id, prices.lines[index]]));
  for (const item of [...pkg.items].sort(itemOrder)) {
    const evidence = offerings.get(item.id);
    if (!evidence || !item.serviceId || !item.employeeId || !item.durationOptionId) continue;
    const key = `${item.serviceId}:${item.employeeId}`;
    const group = groups.get(key) ?? {
      key: `legacy-${item.serviceId}-${item.employeeId}`,
      serviceId: item.serviceId,
      employeeId: item.employeeId,
      sequenceMode: 'UNORDERED',
      dependsOnGroupKey: null,
      sessions: [],
    };
    const line = linesByItem.get(item.id);
    if (!line) throw new Error(`Missing price line for ${item.id}`);
    const paid = Math.max(0, item.paidQuantity);
    const free = Math.max(0, item.freeQuantity ?? 0);
    const paidPrices = distribute(line.net, paid);
    for (const unitPrice of paidPrices) {
      group.sessions.push({
        position: group.sessions.length,
        sourceItemId: item.id,
        durationOptionId: item.durationOptionId,
        deliveryType: evidence.durationDeliveryType as 'IN_PERSON' | 'ONLINE',
        unitPrice,
        free: false,
      });
    }
    for (let index = 0; index < free; index += 1) {
      group.sessions.push({
        position: group.sessions.length,
        sourceItemId: item.id,
        durationOptionId: item.durationOptionId,
        deliveryType: evidence.durationDeliveryType as 'IN_PERSON' | 'ONLINE',
        unitPrice: 0,
        free: true,
      });
    }
    groups.set(key, group);
  }
  const groupValues = [...groups.values()];
  return {
    modelVersion: 'GROUPED_V2',
    globalDiscount: { type: 'NONE', value: 0 },
    subtotal: groupValues.flatMap((group) => group.sessions).reduce((sum, session) => sum + (session.free ? 0 : session.unitPrice), 0),
    finalPrice: groupValues.flatMap((group) => group.sessions).reduce((sum, session) => sum + (session.free ? 0 : session.unitPrice), 0),
    totalRights: groupValues.reduce((sum, group) => sum + group.sessions.length, 0),
    groups: groupValues,
  };
}

export function buildProtectedMapping(
  pkg: LegacyPackage,
  prices: LegacyPackagePrice | null,
  offerings: Map<string, OfferingEvidence>,
  purchasedCount = 0,
  creditCount = 0,
): ProtectedConversionMapping {
  const reasons: string[] = [];
  let classification: ConversionClassification = 'READY_DRAFT';
  if (pkg.items.length === 0) {
    classification = 'INCONSISTENT';
    reasons.push('EMPTY_TEMPLATE');
  }
  for (const item of pkg.items) {
    const result = classifyLegacyItem(item, offerings.get(item.id));
    if (result.classification === 'INCONSISTENT') classification = 'INCONSISTENT';
    else if (result.classification === 'NEEDS_OFFERING_SELECTION' && classification === 'READY_DRAFT') classification = 'NEEDS_OFFERING_SELECTION';
    reasons.push(...result.reasons.map((reason) => `${item.id}:${reason}`));
  }
  const paidRights = pkg.items.reduce((sum, item) => sum + Math.max(0, item.paidQuantity), 0);
  const freeRights = pkg.items.reduce((sum, item) => sum + Math.max(0, item.freeQuantity ?? 0), 0);
  const priceReasons = validateLegacyPrice(pkg, prices);
  if (priceReasons.length > 0) {
    classification = 'INCONSISTENT';
    reasons.push(...priceReasons);
  }
  const before: ConversionBeforeSummary = {
    modelVersion: pkg.modelVersion ?? 'LEGACY',
    itemCount: pkg.items.length,
    paidRights,
    freeRights,
    totalRights: paidRights + freeRights,
    subtotal: prices?.subtotal ?? null,
    discountAmount: prices?.discountAmount ?? null,
    finalPrice: prices?.finalPrice ?? null,
    purchasedCount,
  };
  let after: ConversionAfterPreview | null = null;
  if (classification === 'READY_DRAFT' && prices) {
    after = buildDraftPreview(pkg, prices, offerings);
    if (after.finalPrice !== prices.finalPrice) {
      classification = 'INCONSISTENT';
      reasons.push('PRICE_NET_TOTAL_MISMATCH');
      after = null;
    } else if (after.totalRights !== before.totalRights) {
      classification = 'INCONSISTENT';
      reasons.push('RIGHTS_COUNT_MISMATCH');
      after = null;
    }
  }
  return {
    sourcePackageId: pkg.id,
    sourceRevision: sourceRevision(pkg),
    classification,
    reasons: [...new Set(reasons)],
    before,
    after,
    purchasedRights: {
      classification: 'LEGACY_PURCHASE_UNCHANGED',
      purchaseCount: purchasedCount,
      creditCount,
    },
  };
}

function validHalala(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateLegacyPrice(pkg: LegacyPackage, prices: LegacyPackagePrice | null): string[] {
  if (!prices) return ['PRICE_UNRESOLVED'];
  if (!validHalala(prices.subtotal) || !validHalala(prices.discountAmount) || !validHalala(prices.finalPrice)) return ['PRICE_NOT_INTEGER_HALALAS'];
  if (!Array.isArray(prices.lines) || prices.lines.length !== pkg.items.length) return ['PRICE_LINES_MISMATCH'];
  for (const [index, line] of prices.lines.entries()) {
    if (!validHalala(line.unitPrice) || !validHalala(line.net)) return [`PRICE_LINE_INVALID:${index}`];
  }
  const netTotal = prices.lines.reduce((sum, line) => sum + line.net, 0);
  if (!Number.isSafeInteger(netTotal)) return ['PRICE_NET_TOTAL_OVERFLOW'];
  if (netTotal !== prices.finalPrice) return ['PRICE_NET_TOTAL_MISMATCH'];
  return [];
}

export interface AuditDatabase {
  sessionPackage: { findMany(args: unknown): Promise<LegacyPackage[]> };
  packagePurchase: { findMany(args: unknown): Promise<Array<{ id: string; packageId: string }>> };
  packageCredit: { findMany(args: unknown): Promise<Array<{ id: string; purchaseId: string }>> };
  service: {
    findMany(args: unknown): Promise<Array<{ id: string; isActive?: boolean; archivedAt?: Date | null; isHidden?: boolean; category?: { isActive?: boolean; bookingMode?: string } | null }>>;
    findUniqueOrThrow(args: unknown): Promise<{ price: unknown; durationMins: number; currency: string; id: string }>;
  };
  employee: { findMany(args: unknown): Promise<Array<{ id: string; isActive?: boolean }>> };
  employeeService: { findMany(args: unknown): Promise<Array<{ id: string; employeeId: string; serviceId: string; isActive?: boolean; useCustomPricing?: boolean; disabledDeliveryTypes?: string[] }>> };
  serviceDurationOption: {
    findMany(args: unknown): Promise<Array<{ id: string; serviceId: string; employeeServiceId?: string | null; deliveryType: string; durationMins: number; isActive?: boolean; price?: unknown }>>;
    findFirst(args: unknown): Promise<{ id: string; serviceId: string; employeeServiceId?: string | null; deliveryType: string; durationMins: number; isActive?: boolean; price: unknown; currency: string } | null>;
  };
  serviceBookingConfig: {
    findMany(args: unknown): Promise<Array<{ serviceId: string; deliveryType: string; isActive?: boolean }>>;
    findFirst(args: unknown): Promise<{ price: unknown; durationMins: number } | null>;
  };
  employeeServiceOption: { findFirst(args: unknown): Promise<{ priceOverride: unknown; durationOverride: unknown } | null> };
  $transaction: <T>(fn: (tx: AuditDatabase) => Promise<T>, options?: unknown) => Promise<T>;
  $executeRaw: (query: unknown) => Promise<unknown>;
}

export async function loadOfferingEvidence(
  db: AuditDatabase,
  packages: readonly LegacyPackage[],
): Promise<Map<string, OfferingEvidence>> {
  const items = packages.flatMap((pkg) => pkg.items);
  const serviceIds = [...new Set(items.map((item) => item.serviceId).filter((id): id is string => Boolean(id)))];
  const employeeIds = [...new Set(items.map((item) => item.employeeId).filter((id): id is string => Boolean(id)))];
  const durationIds = [...new Set(items.map((item) => item.durationOptionId).filter((id): id is string => Boolean(id)))];
  if (!db.service || !db.employee || !db.employeeService || !db.serviceDurationOption) return new Map();
  const [services, employees, links, durations, bookingConfigs] = await Promise.all([
    db.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, isActive: true, archivedAt: true, isHidden: true, category: { select: { isActive: true, bookingMode: true } } } }),
    db.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, isActive: true } }),
    db.employeeService.findMany({ where: { employeeId: { in: employeeIds }, serviceId: { in: serviceIds } }, select: { id: true, employeeId: true, serviceId: true, isActive: true, useCustomPricing: true, disabledDeliveryTypes: true } }),
    db.serviceDurationOption.findMany({ where: { id: { in: durationIds } }, select: { id: true, serviceId: true, employeeServiceId: true, deliveryType: true, durationMins: true, isActive: true } }),
    db.serviceBookingConfig?.findMany({ where: { serviceId: { in: serviceIds } }, select: { serviceId: true, deliveryType: true, isActive: true } }) ?? Promise.resolve([]),
  ]);
  const serviceById = new Map(services.map((row) => [row.id, row]));
  const employeeById = new Map(employees.map((row) => [row.id, row]));
  const linkByPair = new Map(links.map((row) => [`${row.employeeId}:${row.serviceId}`, row]));
  const durationById = new Map(durations.map((row) => [row.id, row]));
  const allowedByService = new Map<string, string[]>();
  for (const row of bookingConfigs) {
    if (row.isActive === false) continue;
    const channels = allowedByService.get(row.serviceId) ?? [];
    channels.push(row.deliveryType);
    allowedByService.set(row.serviceId, channels);
  }
  const evidence = new Map<string, OfferingEvidence>();
  for (const item of items) {
    const service = item.serviceId ? serviceById.get(item.serviceId) : undefined;
    const employee = item.employeeId ? employeeById.get(item.employeeId) : undefined;
    const link = item.serviceId && item.employeeId ? linkByPair.get(`${item.employeeId}:${item.serviceId}`) : undefined;
    const duration = item.durationOptionId ? durationById.get(item.durationOptionId) : undefined;
    evidence.set(item.id, {
      serviceId: item.serviceId ?? '',
      employeeId: item.employeeId ?? '',
      durationOptionId: item.durationOptionId ?? '',
      serviceExists: Boolean(service && service.isActive !== false && service.archivedAt == null),
      employeeExists: Boolean(employee && employee.isActive !== false),
      employeeServiceExists: Boolean(link && link.isActive !== false),
      employeeServiceId: link?.id,
      useCustomPricing: link?.useCustomPricing,
      disabledDeliveryTypes: link?.disabledDeliveryTypes ?? [],
      durationExists: Boolean(duration && duration.isActive !== false),
      durationServiceId: duration?.serviceId,
      durationMins: duration?.durationMins,
      durationDeliveryType: duration?.deliveryType,
      durationEmployeeServiceId: duration?.employeeServiceId,
      serviceDeliveryTypes: item.serviceId ? allowedByService.get(item.serviceId) : undefined,
      serviceCategoryActive: service?.category?.isActive,
      serviceIsHidden: service?.isHidden,
      serviceCategoryBookingMode: service?.category?.bookingMode ?? null,
    });
  }
  return evidence;
}

export interface AuditOptions {
  database?: string;
  schema?: string;
  pricePackage?: (pkg: LegacyPackage) => Promise<LegacyPackagePrice>;
  offerings?: Map<string, OfferingEvidence>;
}

function sourcePriceInput(item: LegacyItem) {
  return {
    serviceId: item.serviceId,
    employeeId: item.employeeId,
    durationOptionId: item.durationOptionId,
    unitPrice: item.unitPrice == null ? null : numericValue(item.unitPrice),
    paidQuantity: item.paidQuantity,
    freeQuantity: item.freeQuantity ?? 0,
    discountType: item.discountType as never,
    discountValue: item.discountValue == null ? 0 : numericValue(item.discountValue),
  };
}

function validateSourceMoney(pkg: LegacyPackage): string[] {
  const reasons: string[] = [];
  if (pkg.discountValue != null) {
    const discount = numericValue(pkg.discountValue);
    if (!Number.isFinite(discount) || discount < 0 || (pkg.discountType === 'FIXED' && !Number.isSafeInteger(discount)) || (pkg.discountType === 'PERCENTAGE' && discount > 100)) {
      reasons.push('PACKAGE_DISCOUNT_INVALID');
    }
  }
  for (const item of pkg.items) {
    if (item.unitPrice != null && !validHalala(numericValue(item.unitPrice))) reasons.push(`ITEM_PRICE_INVALID:${item.id}`);
    if (item.discountValue != null) {
      const discount = numericValue(item.discountValue);
      if (!Number.isFinite(discount) || discount < 0 || (item.discountType === 'FIXED' && !Number.isSafeInteger(discount)) || (item.discountType === 'PERCENTAGE' && discount > 100)) {
        reasons.push(`ITEM_DISCOUNT_INVALID:${item.id}`);
      }
    }
  }
  return reasons;
}

async function validateReadyOffering(
  db: AuditDatabase,
  mapping: ProtectedConversionMapping,
): Promise<void> {
  if (mapping.classification !== 'READY_DRAFT' || !mapping.after) return;
  const groups: PackageGroupInputLike[] = mapping.after.groups.map((group) => ({
    key: group.key,
    serviceId: group.serviceId,
    employeeId: group.employeeId,
    sequenceMode: group.sequenceMode,
    dependsOnGroupKey: group.dependsOnGroupKey,
    sessions: group.sessions.map((session) => ({
      key: `${group.key}-${session.position}`,
      position: session.position,
      durationOptionId: session.durationOptionId,
      deliveryType: session.deliveryType,
      unitPrice: session.unitPrice,
    })),
  }));
  await resolvePackageGroupOfferings(db as never, groups);
}

async function runAudit(db: AuditDatabase, options: AuditOptions): Promise<PackageConversionManifest> {
  const packages = await db.sessionPackage.findMany({
    where: { modelVersion: 'LEGACY' },
    orderBy: { id: 'asc' },
    include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], include: { constraints: { orderBy: { dimension: 'asc' }, include: { targets: { orderBy: { targetId: 'asc' } } } } } } },
  });
  const offerings = options.offerings ?? await loadOfferingEvidence(db, packages);
  const packageIds = packages.map((pkg) => pkg.id);
  const purchases = packageIds.length === 0 ? [] : await db.packagePurchase.findMany({ where: { packageId: { in: packageIds } }, select: { id: true, packageId: true } });
  const purchaseIds = purchases.map((purchase) => purchase.id);
  const credits = purchaseIds.length === 0 ? [] : await db.packageCredit.findMany({ where: { purchaseId: { in: purchaseIds } }, select: { id: true, purchaseId: true } });
  const purchaseCount = new Map<string, number>();
  for (const purchase of purchases) purchaseCount.set(purchase.packageId, (purchaseCount.get(purchase.packageId) ?? 0) + 1);
  const creditCount = new Map<string, number>();
  for (const credit of credits) {
    const purchase = purchases.find((candidate) => candidate.id === credit.purchaseId);
    if (purchase) creditCount.set(purchase.packageId, (creditCount.get(purchase.packageId) ?? 0) + 1);
  }
  const mappings: ProtectedConversionMapping[] = [];
  for (const pkg of packages) {
    const invalidMoney = validateSourceMoney(pkg);
    let prices: LegacyPackagePrice | null = null;
    if (invalidMoney.length === 0) {
      try {
        prices = options.pricePackage
          ? await options.pricePackage(pkg)
          : await new ComputePackagePriceService(db as never).compute({ items: pkg.items.map(sourcePriceInput) });
      } catch {
        prices = null;
      }
    }
    const mapping = buildProtectedMapping(pkg, prices, offerings, purchaseCount.get(pkg.id) ?? 0, creditCount.get(pkg.id) ?? 0);
    if (invalidMoney.length > 0) {
      mapping.reasons.push(...invalidMoney);
      mapping.classification = 'INCONSISTENT';
      mapping.after = null;
    }
    if (mapping.classification === 'READY_DRAFT') {
      try {
        await validateReadyOffering(db, mapping);
      } catch {
        mapping.classification = 'INCONSISTENT';
        mapping.reasons.push('SHARED_OFFERING_VALIDATION_FAILED');
        mapping.after = null;
      }
    }
    mappings.push(mapping);
  }
  const aggregate = {
    packageCount: mappings.length,
    readyDrafts: mappings.filter((mapping) => mapping.classification === 'READY_DRAFT').length,
    needsOfferingSelection: mappings.filter((mapping) => mapping.classification === 'NEEDS_OFFERING_SELECTION').length,
    inconsistent: mappings.filter((mapping) => mapping.classification === 'INCONSISTENT').length,
    purchasedRightsUnchanged: mappings.filter((mapping) => mapping.purchasedRights.purchaseCount > 0).length,
  };
  return { version: 1, database: options.database ?? 'unknown', schema: options.schema ?? 'public', generatedAt: new Date().toISOString(), mappings, aggregate };
}

export async function auditPackageTemplates(db: AuditDatabase, options: AuditOptions = {}): Promise<PackageConversionManifest> {
  const execute = async (tx: AuditDatabase) => {
    await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    return runAudit(tx, options);
  };
  return db.$transaction(execute, { isolationLevel: 'RepeatableRead' });
}

export async function writeProtectedJson(path: string, value: unknown): Promise<void> {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.chmod(0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}

export async function readProtectedManifest(path: string): Promise<PackageConversionManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageConversionManifest;
}

export async function runAuditCli(args: readonly string[], environment: { DATABASE_URL?: string } = process.env): Promise<PackageConversionManifest> {
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const expectedIndex = args.indexOf('--expected-database');
  const expectedDatabase = expectedIndex >= 0 ? args[expectedIndex + 1] : undefined;
  if (!output || output.startsWith('--')) throw new Error('Audit requires --output');
  if (!expectedDatabase || expectedDatabase.startsWith('--')) throw new Error('Audit requires --expected-database');
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(expectedDatabase)) throw new Error('Expected database name is invalid');
  if (/(^|[-_])(prod|production|live)([-_]|$)/i.test(expectedDatabase) || /^(prod|production|live)$/i.test(expectedDatabase)) throw new Error('Refusing to run against a production database marker');
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  let parsedUrl: URL;
  try { parsedUrl = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a valid postgres URL'); }
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  if (databaseName !== expectedDatabase) throw new Error('DATABASE_URL database does not match --expected-database');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    await prisma.$connect();
    const identity = await prisma.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
    if (identity[0]?.database !== expectedDatabase) throw new Error('Connected database does not match --expected-database');
    const manifest = await auditPackageTemplates(prisma as never, { database: expectedDatabase });
    await writeProtectedJson(output, manifest);
    return manifest;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  runAuditCli(process.argv.slice(2)).then((manifest) => {
    console.log(`audit complete; packages=${manifest.aggregate.packageCount}`);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'audit failed');
    process.exitCode = 1;
  });
}
