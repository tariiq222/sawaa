import { BadRequestException } from '@nestjs/common';
import type {
  PackagePriceResult,
  PackageLinePrice,
} from '../compute-package-price.service';
import { allocateSessionNet } from './package-group-pricing';
import { validateGroupGraph } from './package-group-policy';
import type { GlobalDiscount, PackageGroupInput } from '@sawaa/shared/types';

export type GroupedCatalogItem = {
  id: string;
  groupId?: string | null;
  sessionPosition?: number | null;
  durationOptionId?: string | null;
  unitPrice?: unknown;
  constraints?: Array<{
    dimension: string;
    mode: string;
    targets?: Array<{ targetId: string }>;
  }>;
};

export type GroupedCatalogGroup = {
  id: string;
  key: string;
  label?: string | null;
  serviceId: string;
  employeeId: string;
  sequenceMode: PackageGroupInput['sequenceMode'];
  dependsOnGroupId?: string | null;
  sortOrder?: number;
  items: GroupedCatalogItem[];
};

export type GroupedCatalogPackage = {
  id?: string;
  modelVersion?: string;
  discountType?: string;
  discountValue?: unknown;
  groups?: GroupedCatalogGroup[];
  items?: GroupedCatalogItem[];
};

/** Result shape for a just-created persisted package; creation always has an id. */
export type CreatedGroupedCatalogPackage = GroupedCatalogPackage & { id: string };

const numeric = (value: unknown): number => Number(typeof value === 'object' && value !== null && 'toString' in value
  ? (value as { toString(): string }).toString()
  : value);

function deliveryFromItem(item: GroupedCatalogItem): 'IN_PERSON' | 'ONLINE' {
  const constraints = item.constraints?.filter((candidate) => candidate.dimension === 'DELIVERY_TYPE') ?? [];
  const constraint = constraints[0];
  const targets = constraint?.targets ?? [];
  const target = targets[0]?.targetId;
  if (
    constraints.length !== 1 ||
    constraint?.mode !== 'INCLUDE' ||
    targets.length !== 1 ||
    (target !== 'ONLINE' && target !== 'IN_PERSON')
  ) {
    throw new BadRequestException(`Grouped package item ${item.id} has no valid delivery constraint`);
  }
  return target;
}

function discountFromPackage(pkg: GroupedCatalogPackage): GlobalDiscount {
  if (pkg.discountType === 'FIXED') return { type: 'FIXED', value: numeric(pkg.discountValue) };
  if (pkg.discountType === 'PERCENTAGE' && numeric(pkg.discountValue) !== 0) {
    return { type: 'PERCENTAGE', value: numeric(pkg.discountValue) };
  }
  return { type: 'NONE', value: 0 };
}

/** Normalize Prisma V2 group rows into the editor/purchase-facing contract. */
export function decorateGroupedPackage<T extends GroupedCatalogPackage>(pkg: T): Omit<T, 'groups'> & {
  modelVersion: string;
  groups: PackageGroupInput[];
  globalDiscount: GlobalDiscount;
} {
  if (pkg.modelVersion !== 'GROUPED_V2') {
    return {
      ...pkg,
      modelVersion: pkg.modelVersion ?? 'LEGACY',
      groups: [],
      globalDiscount: { type: 'NONE', value: 0 },
    };
  }

  if (!pkg.groups || pkg.groups.length === 0) {
    throw new BadRequestException('Stored GROUPED_V2 package has no groups');
  }
  const byId = new Map(pkg.groups.map((candidate) => [candidate.id, candidate.key]));
  if (pkg.items?.some((item) => !item.groupId || !byId.has(item.groupId))) {
    throw new BadRequestException('Stored GROUPED_V2 package has orphan template items');
  }

  const groups = [...(pkg.groups ?? [])]
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((group) => {
      if (!group.items || group.items.length === 0) {
        throw new BadRequestException(`Stored GROUPED_V2 group has no sessions: ${group.key}`);
      }
      if (group.dependsOnGroupId && !byId.has(group.dependsOnGroupId)) {
        throw new BadRequestException(`Stored GROUPED_V2 group has an unknown dependency: ${group.key}`);
      }
      const items = [...group.items].sort((left, right) => (left.sessionPosition ?? -1) - (right.sessionPosition ?? -1));
      return {
        key: group.key,
        ...(group.label != null && { label: group.label }),
        serviceId: group.serviceId,
        employeeId: group.employeeId,
        sequenceMode: group.sequenceMode,
        dependsOnGroupKey: group.dependsOnGroupId ? (byId.get(group.dependsOnGroupId) ?? null) : null,
        sessions: items.map((item, index) => {
          const position = item.sessionPosition;
          if (position !== index || !Number.isSafeInteger(position)) {
            throw new BadRequestException(`Stored GROUPED_V2 sessions have invalid positions: ${group.key}`);
          }
          if (item.unitPrice == null || !item.durationOptionId || !Number.isSafeInteger(numeric(item.unitPrice)) || numeric(item.unitPrice) < 0) {
            throw new BadRequestException(`Stored GROUPED_V2 session is missing a valid duration or price: ${item.id}`);
          }
          return {
          key: item.id,
          position,
          durationOptionId: item.durationOptionId,
          deliveryType: deliveryFromItem(item),
          unitPrice: numeric(item.unitPrice),
          };
        }),
      };
    });

  validateGroupGraph(groups);
  return {
    ...pkg,
    modelVersion: 'GROUPED_V2',
    groups,
    globalDiscount: discountFromPackage(pkg),
  };
}

/** Apply the V2 global discount while leaving the legacy algorithm untouched. */
export function applyGroupedPackagePrice(
  pkg: GroupedCatalogPackage & { groups?: GroupedCatalogGroup[] },
  legacyPrice: PackagePriceResult,
): PackagePriceResult {
  if (pkg.modelVersion !== 'GROUPED_V2') return legacyPrice;

  const sessions = [...(pkg.groups ?? [])]
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .flatMap((group) => [...group.items].sort((left, right) => (left.sessionPosition ?? 0) - (right.sessionPosition ?? 0)));
  const unitPrices = sessions.map((item) => numeric(item.unitPrice));
  const allocation = allocateSessionNet(unitPrices, discountFromPackage(pkg));
  const lines: PackageLinePrice[] = sessions.map((item, index) => {
    const unitPrice = unitPrices[index];
    const net = allocation.sessionNet[index];
    return {
      durationOptionId: item.durationOptionId ?? null,
      unitPrice,
      fullValue: unitPrice,
      freeValue: 0,
      payable: unitPrice,
      discountAmount: unitPrice - net,
      net,
    };
  });

  return {
    subtotal: allocation.subtotal,
    discountAmount: allocation.discountAmount,
    finalPrice: allocation.amountPaid,
    fullValue: unitPrices.reduce((sum, value) => sum + value, 0),
    freeValue: 0,
    itemUnitPrices: sessions.map((item, index) => ({
      durationOptionId: item.durationOptionId ?? null,
      unitPrice: unitPrices[index],
    })),
    lines,
  };
}
