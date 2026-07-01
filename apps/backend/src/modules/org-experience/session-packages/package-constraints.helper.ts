import { BadRequestException } from '@nestjs/common';
import {
  DeliveryType,
  DiscountType,
  PackageConstraintDimension,
  PackageConstraintMode,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { toHalalas } from '../../finance/money.helper';
import { CreateSessionPackageItemDto } from './create-session-package/create-session-package.dto';

/**
 * Shared normalisation + validation for flexible package items. A package item is
 * either single-specific (legacy triple, price derivable) or flexible (rule-based
 * constraints with a fixed unitPrice). Both create and update go through here so
 * the invariants live in one place.
 */

export interface NormalizedConstraint {
  dimension: PackageConstraintDimension;
  mode: PackageConstraintMode;
  targetIds: string[];
}

export interface NormalizedItem {
  constraints: NormalizedConstraint[];
  /** Single-specific value per dimension (else null) — kept on the item as a legacy ref. */
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  unitPrice: number | null;
  isSingleSpecific: boolean;
}

const DELIVERY_TYPES = new Set<string>(Object.values(DeliveryType));

/** Value to persist on SessionPackageItem.discountValue (PERCENTAGE as-is, FIXED→halalas). */
export function normalizeDiscountValue(
  discountType: DiscountType | null | undefined,
  rawValue: number | undefined,
): number {
  if (!discountType || !rawValue) return 0;
  if (discountType === DiscountType.PERCENTAGE) return rawValue;
  return toHalalas(rawValue).toNumber();
}

function singleInclude(
  byDim: Map<PackageConstraintDimension, NormalizedConstraint>,
  dim: PackageConstraintDimension,
): string | null {
  const c = byDim.get(dim);
  if (c && c.mode === PackageConstraintMode.INCLUDE && c.targetIds.length === 1) {
    return c.targetIds[0];
  }
  return null;
}

/** Normalise one item to its canonical constraint set + derived single-specific refs. */
export function normalizeItem(item: CreateSessionPackageItemDto): NormalizedItem {
  let constraints: NormalizedConstraint[];

  if (item.constraints && item.constraints.length > 0) {
    const seen = new Set<PackageConstraintDimension>();
    constraints = item.constraints.map((c) => {
      if (seen.has(c.dimension)) {
        throw new BadRequestException(`Duplicate constraint dimension: ${c.dimension}`);
      }
      seen.add(c.dimension);
      const targetIds = c.targetIds ?? [];
      if (c.mode === PackageConstraintMode.ANY && targetIds.length > 0) {
        throw new BadRequestException(`ANY constraint for ${c.dimension} must have no targets`);
      }
      if (c.mode !== PackageConstraintMode.ANY && targetIds.length === 0) {
        throw new BadRequestException(`${c.mode} constraint for ${c.dimension} needs at least one target`);
      }
      return { dimension: c.dimension, mode: c.mode, targetIds };
    });
  } else {
    // Legacy input: the full triple must be present to synthesise INCLUDE rules.
    if (!item.serviceId || !item.employeeId || !item.durationOptionId) {
      throw new BadRequestException(
        'A package item needs either constraints or a full (serviceId, employeeId, durationOptionId) triple',
      );
    }
    constraints = [
      { dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.INCLUDE, targetIds: [item.serviceId] },
      { dimension: PackageConstraintDimension.PRACTITIONER, mode: PackageConstraintMode.INCLUDE, targetIds: [item.employeeId] },
      { dimension: PackageConstraintDimension.DURATION, mode: PackageConstraintMode.INCLUDE, targetIds: [item.durationOptionId] },
    ];
  }

  const byDim = new Map(constraints.map((c) => [c.dimension, c]));
  const serviceId = singleInclude(byDim, PackageConstraintDimension.SERVICE);
  const employeeId = singleInclude(byDim, PackageConstraintDimension.PRACTITIONER);
  const durationOptionId = singleInclude(byDim, PackageConstraintDimension.DURATION);
  const isSingleSpecific = serviceId !== null && employeeId !== null && durationOptionId !== null;

  // Duration can only be pinned when the service is a single specific service.
  const durationConstraint = byDim.get(PackageConstraintDimension.DURATION);
  if (
    durationConstraint &&
    durationConstraint.mode !== PackageConstraintMode.ANY &&
    serviceId === null
  ) {
    throw new BadRequestException(
      'DURATION can only be constrained when SERVICE is a single specific service',
    );
  }

  const unitPrice = item.unitPrice ?? null;
  if (!isSingleSpecific && unitPrice === null) {
    throw new BadRequestException(
      'A flexible package item requires a fixed unitPrice (integer halalas)',
    );
  }

  // Delivery-type targets must be valid enum values.
  const delivery = byDim.get(PackageConstraintDimension.DELIVERY_TYPE);
  if (delivery) {
    for (const t of delivery.targetIds) {
      if (!DELIVERY_TYPES.has(t)) {
        throw new BadRequestException(`Invalid delivery type target: ${t}`);
      }
    }
  }

  return { constraints, serviceId, employeeId, durationOptionId, unitPrice, isSingleSpecific };
}

/** Validate an item set against the DB (existence + employee-service links). Throws on any issue. */
export async function validatePackageItems(
  prisma: PrismaService,
  items: CreateSessionPackageItemDto[],
): Promise<NormalizedItem[]> {
  // Quantities.
  const emptyItem = items.findIndex((i) => (i.paidQuantity ?? 0) + (i.freeQuantity ?? 0) < 1);
  if (emptyItem !== -1) {
    throw new BadRequestException(
      'Each item must have at least one session (paidQuantity + freeQuantity >= 1)',
    );
  }

  const normalized = items.map(normalizeItem);

  const collect = (dim: PackageConstraintDimension) =>
    normalized.flatMap((n) =>
      n.constraints
        .filter((c) => c.dimension === dim && c.mode !== PackageConstraintMode.ANY)
        .flatMap((c) => c.targetIds),
    );

  const serviceTargets = [...new Set(collect(PackageConstraintDimension.SERVICE))];
  const employeeTargets = [...new Set(collect(PackageConstraintDimension.PRACTITIONER))];
  const durationTargets = [...new Set(collect(PackageConstraintDimension.DURATION))];

  const [services, employees, durations] = await Promise.all([
    serviceTargets.length
      ? prisma.service.findMany({ where: { id: { in: serviceTargets } }, select: { id: true } })
      : Promise.resolve([]),
    employeeTargets.length
      ? prisma.employee.findMany({ where: { id: { in: employeeTargets } }, select: { id: true } })
      : Promise.resolve([]),
    durationTargets.length
      ? prisma.serviceDurationOption.findMany({
          where: { id: { in: durationTargets }, isActive: true },
          select: { id: true, serviceId: true },
        })
      : Promise.resolve([]),
  ]);

  const serviceSet = new Set(services.map((s) => s.id));
  const employeeSet = new Set(employees.map((e) => e.id));
  const durationServiceMap = new Map(durations.map((d) => [d.id, d.serviceId]));

  for (const t of serviceTargets) {
    if (!serviceSet.has(t)) throw new BadRequestException(`Service not found: ${t}`);
  }
  for (const t of employeeTargets) {
    if (!employeeSet.has(t)) throw new BadRequestException(`Employee not found: ${t}`);
  }
  for (const t of durationTargets) {
    if (!durationServiceMap.has(t)) throw new BadRequestException(`Duration option not found or inactive: ${t}`);
  }

  // Single-specific items: duration must belong to the service AND the employee
  // must provide the service (mirrors the legacy per-item validation).
  const singleLinks = normalized.filter((n) => n.isSingleSpecific);
  for (const n of singleLinks) {
    if (durationServiceMap.get(n.durationOptionId!) !== n.serviceId) {
      throw new BadRequestException('Duration option not found for this service');
    }
  }
  if (singleLinks.length) {
    const links = await prisma.employeeService.findMany({
      where: {
        isActive: true,
        OR: singleLinks.map((n) => ({ employeeId: n.employeeId!, serviceId: n.serviceId! })),
      },
      select: { employeeId: true, serviceId: true },
    });
    const linkSet = new Set(links.map((l) => `${l.employeeId}::${l.serviceId}`));
    const missing = singleLinks.find((n) => !linkSet.has(`${n.employeeId}::${n.serviceId}`));
    if (missing) {
      throw new BadRequestException('Employee does not provide this service');
    }
  }

  return normalized;
}

/** Prisma nested-create for a single item's constraints. */
export function buildItemConstraintsCreate(n: NormalizedItem) {
  return n.constraints.map((c) => ({
    dimension: c.dimension,
    mode: c.mode,
    targets: { create: c.targetIds.map((targetId) => ({ targetId })) },
  }));
}

/** Prisma create data for one SessionPackageItem (with nested constraints). */
export function buildItemCreateData(
  item: CreateSessionPackageItemDto,
  n: NormalizedItem,
  idx: number,
) {
  return {
    serviceId: n.serviceId,
    employeeId: n.employeeId,
    durationOptionId: n.durationOptionId,
    unitPrice: n.unitPrice != null ? (n.unitPrice as unknown as Prisma.Decimal) : null,
    label: item.label ?? null,
    paidQuantity: item.paidQuantity,
    freeQuantity: item.freeQuantity ?? 0,
    discountType: item.discountType ?? null,
    discountValue: normalizeDiscountValue(item.discountType, item.discountValue) as unknown as Prisma.Decimal,
    sortOrder: item.sortOrder ?? idx,
    constraints: { create: buildItemConstraintsCreate(n) },
  };
}

/** Pricing-service input for one item (unitPrice wins; else the legacy triple). */
export function buildPriceInput(item: CreateSessionPackageItemDto, n: NormalizedItem) {
  return {
    serviceId: n.serviceId,
    employeeId: n.employeeId,
    durationOptionId: n.durationOptionId,
    unitPrice: n.unitPrice,
    paidQuantity: item.paidQuantity,
    freeQuantity: item.freeQuantity ?? 0,
    discountType: item.discountType ?? null,
    discountValue: normalizeDiscountValue(item.discountType, item.discountValue),
  };
}
