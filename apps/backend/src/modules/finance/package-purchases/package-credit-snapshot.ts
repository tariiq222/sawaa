import {
  PackageConstraintDimension,
  PackageConstraintMode,
  type Prisma,
} from '@prisma/client';
import type { ItemConstraintInput } from './build-credit-constraints.helper';

export interface PackageCreditSnapshotItem {
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  unitPriceSnapshot: number;
  totalQuantity: number;
  constraints: ItemConstraintInput[];
}

interface SnapshotSourceItem {
  serviceId: string | null;
  employeeId: string | null;
  durationOptionId: string | null;
  paidQuantity: number;
  freeQuantity: number;
  constraints?: ItemConstraintInput[];
}

export function createPackageCreditSnapshot(
  items: SnapshotSourceItem[],
  itemUnitPrices: { unitPrice: number }[],
): PackageCreditSnapshotItem[] {
  return items.map((item, index) => ({
    serviceId: item.serviceId,
    employeeId: item.employeeId,
    durationOptionId: item.durationOptionId,
    unitPriceSnapshot: itemUnitPrices[index]?.unitPrice ?? 0,
    totalQuantity: item.paidQuantity + item.freeQuantity,
    constraints: item.constraints ?? [],
  }));
}

const dimensions = new Set<string>(Object.values(PackageConstraintDimension));
const modes = new Set<string>(Object.values(PackageConstraintMode));

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Fail closed when a persisted JSON snapshot is malformed. */
export function parsePackageCreditSnapshot(
  value: Prisma.JsonValue | null,
): PackageCreditSnapshotItem[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length === 0) return null;

  const parsed: PackageCreditSnapshotItem[] = [];
  for (const raw of value) {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    if (
      !nullableString(item.serviceId) ||
      !nullableString(item.employeeId) ||
      !nullableString(item.durationOptionId) ||
      typeof item.unitPriceSnapshot !== 'number' ||
      !Number.isFinite(item.unitPriceSnapshot) ||
      typeof item.totalQuantity !== 'number' ||
      !Number.isInteger(item.totalQuantity) ||
      item.totalQuantity <= 0 ||
      !Array.isArray(item.constraints)
    ) {
      return null;
    }

    const constraints: ItemConstraintInput[] = [];
    for (const rawConstraint of item.constraints) {
      if (
        !rawConstraint ||
        Array.isArray(rawConstraint) ||
        typeof rawConstraint !== 'object'
      ) {
        return null;
      }
      const constraint = rawConstraint as Record<string, unknown>;
      if (
        typeof constraint.dimension !== 'string' ||
        !dimensions.has(constraint.dimension) ||
        typeof constraint.mode !== 'string' ||
        !modes.has(constraint.mode) ||
        !Array.isArray(constraint.targets) ||
        !constraint.targets.every(
          (target) =>
            !!target &&
            !Array.isArray(target) &&
            typeof target === 'object' &&
            typeof (target as Record<string, unknown>).targetId === 'string',
        )
      ) {
        return null;
      }
      constraints.push({
        dimension: constraint.dimension as PackageConstraintDimension,
        mode: constraint.mode as PackageConstraintMode,
        targets: constraint.targets.map((target) => ({
          targetId: (target as Record<string, string>).targetId,
        })),
      });
    }

    parsed.push({
      serviceId: item.serviceId,
      employeeId: item.employeeId,
      durationOptionId: item.durationOptionId,
      unitPriceSnapshot: item.unitPriceSnapshot,
      totalQuantity: item.totalQuantity,
      constraints,
    });
  }
  return parsed;
}
