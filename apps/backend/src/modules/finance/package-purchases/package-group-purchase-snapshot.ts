import { BadRequestException } from '@nestjs/common';
import { PackageConstraintDimension, PackageConstraintMode, Prisma } from '@prisma/client';
import type { DeliveryType } from '@sawaa/shared/types';
import type { ItemConstraintInput } from './build-credit-constraints.helper';
import { parsePackageCreditSnapshot, type PackageCreditSnapshotItem } from './package-credit-snapshot';
import { applyGroupedPackagePrice, type GroupedCatalogPackage } from '../../org-experience/session-packages/package-group-catalog.helper';
import type { ResolvedPackageGroupOffering } from '../../org-experience/session-packages/package-group-offering.helper';
import type { GlobalDiscount } from '@sawaa/shared/types';

export const GROUPED_PURCHASE_SNAPSHOT_VERSION = 2 as const;
export const GROUPED_PURCHASE_MODEL_VERSION = 'GROUPED_V2' as const;

export interface GroupedPurchaseGroupSnapshot {
  key: string;
  label: string | null;
  serviceId: string;
  employeeId: string;
  sequenceMode: 'ORDERED' | 'UNORDERED';
  dependsOnGroupKey: string | null;
  sortOrder: number;
}

export interface GroupedPurchaseCreditSnapshot {
  groupKey: string;
  sessionPosition: number;
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  unitPriceSnapshot: number;
  netValue: number;
  totalQuantity: 1;
  constraints: ItemConstraintInput[];
  durationMinsSnapshot: number;
  deliveryTypeSnapshot: DeliveryType;
  serviceNameSnapshot: string;
  employeeNameSnapshot: string;
  listPriceSnapshot: number;
}

export interface GroupedPackagePurchaseSnapshot {
  version: typeof GROUPED_PURCHASE_SNAPSHOT_VERSION;
  modelVersion: typeof GROUPED_PURCHASE_MODEL_VERSION;
  groups: GroupedPurchaseGroupSnapshot[];
  credits: GroupedPurchaseCreditSnapshot[];
}

export type GroupedPurchaseOffering = ResolvedPackageGroupOffering & { sortOrder: number };

export function createGroupedPackagePurchaseSnapshot(
  offerings: readonly GroupedPurchaseOffering[],
  globalDiscount: GlobalDiscount,
): { snapshot: GroupedPackagePurchaseSnapshot; price: { subtotal: number; discountAmount: number; finalPrice: number; itemUnitPrices: { unitPrice: number }[]; lines: { net: number }[] } } {
  const orderedGroups = [...offerings].sort((a, b) => a.sortOrder - b.sortOrder);
  const catalog: GroupedCatalogPackage = {
    modelVersion: GROUPED_PURCHASE_MODEL_VERSION,
    discountType: globalDiscount.type === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
    discountValue: globalDiscount.type === 'NONE' ? 0 : globalDiscount.value,
    groups: orderedGroups.map((group) => ({
      id: group.key,
      key: group.key,
      serviceId: group.serviceId,
      employeeId: group.employeeId,
      sequenceMode: group.sequenceMode,
      dependsOnGroupId: group.dependsOnGroupKey,
      sortOrder: group.sortOrder,
      items: group.sessions.map((session) => ({
        id: session.key,
        sessionPosition: session.position,
        durationOptionId: session.durationOptionId,
        unitPrice: session.unitPrice,
      })),
    })),
  };
  const price = applyGroupedPackagePrice(catalog, {
    subtotal: 0,
    discountAmount: 0,
    finalPrice: 0,
    fullValue: 0,
    freeValue: 0,
    itemUnitPrices: [],
    lines: [],
  });
  const credits: GroupedPurchaseCreditSnapshot[] = [];
  let lineIndex = 0;
  for (const group of orderedGroups) {
    for (const session of [...group.sessions].sort((a, b) => a.position - b.position)) {
      const constraints: ItemConstraintInput[] = [
        { dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.INCLUDE, targets: [{ targetId: group.serviceId }] },
        { dimension: PackageConstraintDimension.PRACTITIONER, mode: PackageConstraintMode.INCLUDE, targets: [{ targetId: group.employeeId }] },
        { dimension: PackageConstraintDimension.DURATION, mode: PackageConstraintMode.INCLUDE, targets: [{ targetId: session.durationOptionId }] },
        { dimension: PackageConstraintDimension.DELIVERY_TYPE, mode: PackageConstraintMode.INCLUDE, targets: [{ targetId: session.deliveryType }] },
      ];
      const line = price.lines[lineIndex];
      if (!line) throw new BadRequestException('Grouped package price lines do not match session ordering');
      if (![session.unitPrice, line.net, session.durationMins, session.listPrice].every((value) => Number.isSafeInteger(value) && value >= 0)) {
        throw new BadRequestException('Grouped package snapshot contains invalid money or duration metadata');
      }
      credits.push({
        groupKey: group.key,
        sessionPosition: session.position,
        serviceId: group.serviceId,
        employeeId: group.employeeId,
        durationOptionId: session.durationOptionId,
        unitPriceSnapshot: session.unitPrice,
        netValue: line.net,
        totalQuantity: 1,
        constraints,
        durationMinsSnapshot: session.durationMins,
        deliveryTypeSnapshot: session.deliveryType,
        serviceNameSnapshot: session.serviceName,
        employeeNameSnapshot: session.employeeName,
        listPriceSnapshot: session.listPrice,
      });
      lineIndex += 1;
    }
  }
  const snapshot: GroupedPackagePurchaseSnapshot = {
      version: GROUPED_PURCHASE_SNAPSHOT_VERSION,
      modelVersion: GROUPED_PURCHASE_MODEL_VERSION,
      groups: orderedGroups.map((group) => ({
        key: group.key,
        label: group.label?.trim() || null,
        serviceId: group.serviceId,
        employeeId: group.employeeId,
        sequenceMode: group.sequenceMode,
        dependsOnGroupKey: group.dependsOnGroupKey ?? null,
        sortOrder: group.sortOrder,
      })),
      credits,
  };
  return {
    snapshot: parseGroupedPackagePurchaseSnapshot(snapshot as unknown as Prisma.JsonValue),
    price: {
      subtotal: price.subtotal,
      discountAmount: price.discountAmount,
      finalPrice: price.finalPrice,
      itemUnitPrices: price.itemUnitPrices,
      lines: price.lines,
    },
  };
}

export type PackagePurchaseSnapshot =
  | { kind: 'LEGACY'; items: PackageCreditSnapshotItem[] }
  | { kind: 'GROUPED_V2'; snapshot: GroupedPackagePurchaseSnapshot };

const dimensions = new Set<string>(Object.values(PackageConstraintDimension));
const modes = new Set<string>(Object.values(PackageConstraintMode));
const deliveries = new Set<string>(['IN_PERSON', 'ONLINE']);
const MAX_SNAPSHOT_MONEY = 9_999_999_999;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: ${field}`);
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: ${field}`);
  }
  return value as number;
}

function parseConstraints(value: unknown, field: string): ItemConstraintInput[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: ${field}`);
  }
  return value.map((raw, index) => {
    if (!isRecord(raw) || typeof raw.dimension !== 'string' || !dimensions.has(raw.dimension) ||
      typeof raw.mode !== 'string' || !modes.has(raw.mode) || !Array.isArray(raw.targets)) {
      throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: ${field}[${index}]`);
    }
    const targets = raw.targets.map((target, targetIndex) => {
      if (!isRecord(target)) {
        throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: ${field}[${index}].targets[${targetIndex}]`);
      }
      return { targetId: requiredString(target.targetId, `${field}[${index}].targets[${targetIndex}].targetId`) };
    });
    return {
      dimension: raw.dimension as PackageConstraintDimension,
      mode: raw.mode as PackageConstraintMode,
      targets,
    };
  });
}

/** Parse only the strict V2 object. Unknown versions and incomplete objects fail closed. */
export function parseGroupedPackagePurchaseSnapshot(value: Prisma.JsonValue | null): GroupedPackagePurchaseSnapshot {
  if (!isRecord(value)) {
    throw new BadRequestException('GROUPED_V2 purchase snapshot must be an object');
  }
  if (value.version !== GROUPED_PURCHASE_SNAPSHOT_VERSION || value.modelVersion !== GROUPED_PURCHASE_MODEL_VERSION) {
    throw new BadRequestException('Unsupported package purchase snapshot version');
  }
  if (!Array.isArray(value.groups) || value.groups.length === 0 || !Array.isArray(value.credits) || value.credits.length === 0) {
    throw new BadRequestException('GROUPED_V2 purchase snapshot is missing groups or credits');
  }

  const groups = value.groups.map((raw, index): GroupedPurchaseGroupSnapshot => {
    if (!isRecord(raw)) throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot group ${index}`);
    const label = raw.label === null ? null : requiredString(raw.label, `groups[${index}].label`);
    const dependsOnGroupKey = raw.dependsOnGroupKey === null ? null : requiredString(raw.dependsOnGroupKey, `groups[${index}].dependsOnGroupKey`);
    const sortOrder = requiredInteger(raw.sortOrder, `groups[${index}].sortOrder`);
    const sequenceMode = requiredString(raw.sequenceMode, `groups[${index}].sequenceMode`);
    if (sequenceMode !== 'ORDERED' && sequenceMode !== 'UNORDERED') {
      throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: groups[${index}].sequenceMode`);
    }
    return {
      key: requiredString(raw.key, `groups[${index}].key`),
      label,
      serviceId: requiredString(raw.serviceId, `groups[${index}].serviceId`),
      employeeId: requiredString(raw.employeeId, `groups[${index}].employeeId`),
      sequenceMode,
      dependsOnGroupKey,
      sortOrder,
    };
  });

  const groupKeys = new Set<string>();
  const groupSortOrders = new Set<number>();
  for (const group of groups) {
    if (groupKeys.has(group.key)) throw new BadRequestException('GROUPED_V2 purchase snapshot has duplicate group keys');
    groupKeys.add(group.key);
    if (groupSortOrders.has(group.sortOrder)) throw new BadRequestException('GROUPED_V2 purchase snapshot has duplicate group ordering');
    groupSortOrders.add(group.sortOrder);
    if (group.dependsOnGroupKey !== null && !groupKeys.has(group.dependsOnGroupKey) && !groups.some((candidate) => candidate.key === group.dependsOnGroupKey)) {
      throw new BadRequestException('GROUPED_V2 purchase snapshot has an unknown dependency');
    }
  }
  if ([...groupSortOrders].sort((left, right) => left - right).some((sortOrder, index) => sortOrder !== index)) {
    throw new BadRequestException('GROUPED_V2 purchase snapshot has invalid group ordering');
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): void => {
    if (visiting.has(key)) throw new BadRequestException('GROUPED_V2 purchase snapshot has a dependency cycle');
    if (visited.has(key)) return;
    visiting.add(key);
    const dependency = groups.find((candidate) => candidate.key === key)?.dependsOnGroupKey;
    if (dependency !== null && dependency !== undefined) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  };
  for (const group of groups) visit(group.key);

  const credits = value.credits.map((raw, index): GroupedPurchaseCreditSnapshot => {
    if (!isRecord(raw)) throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot credit ${index}`);
    const delivery = requiredString(raw.deliveryTypeSnapshot, `credits[${index}].deliveryTypeSnapshot`);
    if (!deliveries.has(delivery)) throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot field: credits[${index}].deliveryTypeSnapshot`);
    const totalQuantity = requiredInteger(raw.totalQuantity, `credits[${index}].totalQuantity`);
    if (totalQuantity !== 1) throw new BadRequestException('GROUPED_V2 purchase credits must have totalQuantity=1');
    const unitPriceSnapshot = requiredInteger(raw.unitPriceSnapshot, `credits[${index}].unitPriceSnapshot`);
    const netValue = requiredInteger(raw.netValue, `credits[${index}].netValue`);
    const durationMinsSnapshot = requiredInteger(raw.durationMinsSnapshot, `credits[${index}].durationMinsSnapshot`);
    if (unitPriceSnapshot > MAX_SNAPSHOT_MONEY || netValue > MAX_SNAPSHOT_MONEY || netValue > unitPriceSnapshot) {
      throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot money at credits[${index}]`);
    }
    if (durationMinsSnapshot <= 0) {
      throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot duration at credits[${index}]`);
    }
    const serviceId = requiredString(raw.serviceId, `credits[${index}].serviceId`);
    const employeeId = requiredString(raw.employeeId, `credits[${index}].employeeId`);
    const durationOptionId = requiredString(raw.durationOptionId, `credits[${index}].durationOptionId`);
    const constraints = parseConstraints(raw.constraints, `credits[${index}].constraints`);
    const listPriceSnapshot = requiredInteger(raw.listPriceSnapshot, `credits[${index}].listPriceSnapshot`);
    if (listPriceSnapshot > MAX_SNAPSHOT_MONEY) {
      throw new BadRequestException(`Invalid GROUPED_V2 purchase snapshot list price at credits[${index}]`);
    }
    const expectedConstraints: Array<[PackageConstraintDimension, string]> = [
      [PackageConstraintDimension.SERVICE, serviceId],
      [PackageConstraintDimension.PRACTITIONER, employeeId],
      [PackageConstraintDimension.DURATION, durationOptionId],
      [PackageConstraintDimension.DELIVERY_TYPE, delivery],
    ];
    if (constraints.length !== expectedConstraints.length || expectedConstraints.some(([dimension, targetId]) => {
      const matches = constraints.filter((constraint) => constraint.dimension === dimension);
      return matches.length !== 1 || matches[0].mode !== PackageConstraintMode.INCLUDE ||
        matches[0].targets.length !== 1 || matches[0].targets[0]?.targetId !== targetId;
    })) {
      throw new BadRequestException(`GROUPED_V2 purchase snapshot constraints do not match credits[${index}]`);
    }
    return {
      groupKey: requiredString(raw.groupKey, `credits[${index}].groupKey`),
      sessionPosition: requiredInteger(raw.sessionPosition, `credits[${index}].sessionPosition`),
      serviceId,
      employeeId,
      durationOptionId,
      unitPriceSnapshot,
      netValue,
      totalQuantity: 1,
      constraints,
      durationMinsSnapshot,
      deliveryTypeSnapshot: delivery as DeliveryType,
      serviceNameSnapshot: requiredString(raw.serviceNameSnapshot, `credits[${index}].serviceNameSnapshot`),
      employeeNameSnapshot: requiredString(raw.employeeNameSnapshot, `credits[${index}].employeeNameSnapshot`),
      listPriceSnapshot,
    };
  });

  const seenCredits = new Set<string>();
  for (const credit of credits) {
    const group = groups.find((candidate) => candidate.key === credit.groupKey);
    if (!group) throw new BadRequestException('GROUPED_V2 purchase snapshot credit references an unknown group');
    if (credit.serviceId !== group.serviceId || credit.employeeId !== group.employeeId) {
      throw new BadRequestException('GROUPED_V2 purchase snapshot credit identity does not match its group');
    }
    const identity = `${credit.groupKey}:${credit.sessionPosition}`;
    if (seenCredits.has(identity)) throw new BadRequestException('GROUPED_V2 purchase snapshot has duplicate credit positions');
    seenCredits.add(identity);
  }
  for (const group of groups) {
    const positions = credits
      .filter((credit) => credit.groupKey === group.key)
      .sort((left, right) => left.sessionPosition - right.sessionPosition)
      .map((credit) => credit.sessionPosition);
    if (positions.length === 0 || positions.some((position, index) => position !== index)) {
      throw new BadRequestException(`GROUPED_V2 purchase snapshot has invalid session positions: ${group.key}`);
    }
  }
  return { version: 2, modelVersion: 'GROUPED_V2', groups, credits };
}

/** Classify an immutable JSON value while retaining the old array parser. */
export function parsePackagePurchaseSnapshot(value: Prisma.JsonValue | null): PackagePurchaseSnapshot | null {
  if (Array.isArray(value)) {
    const items = parsePackageCreditSnapshot(value);
    return items ? { kind: 'LEGACY', items } : null;
  }
  if (value === null) return null;
  return { kind: 'GROUPED_V2', snapshot: parseGroupedPackagePurchaseSnapshot(value) };
}

/** Build the nested writes used by activation/manual sales for a V2 snapshot. */
export async function issueGroupedPackageCredits(
  tx: Prisma.TransactionClient,
  purchaseId: string,
  snapshot: GroupedPackagePurchaseSnapshot,
): Promise<void> {
  const groupRows = new Map<string, { id: string }>();
  for (const group of [...snapshot.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const created = await tx.packagePurchaseGroup.create({
      data: {
        purchaseId,
        key: group.key,
        label: group.label,
        serviceId: group.serviceId,
        employeeId: group.employeeId,
        sequenceMode: group.sequenceMode,
        sortOrder: group.sortOrder,
      },
      select: { id: true },
    });
    groupRows.set(group.key, created);
  }
  for (const group of [...snapshot.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (group.dependsOnGroupKey !== null) {
      const dependsOn = groupRows.get(group.dependsOnGroupKey);
      if (!dependsOn) throw new BadRequestException('GROUPED_V2 purchase dependency cannot be remapped');
      await tx.packagePurchaseGroup.update({ where: { id: groupRows.get(group.key)!.id }, data: { dependsOnGroupId: dependsOn.id } });
    }
  }
  for (const credit of [...snapshot.credits].sort((a, b) => {
    const left = snapshot.groups.find((group) => group.key === a.groupKey)?.sortOrder ?? 0;
    const right = snapshot.groups.find((group) => group.key === b.groupKey)?.sortOrder ?? 0;
    return left - right || a.sessionPosition - b.sessionPosition;
  })) {
    await tx.packageCredit.create({
      data: {
        purchaseId,
        purchaseGroupId: groupRows.get(credit.groupKey)!.id,
        sessionPosition: credit.sessionPosition,
        serviceId: credit.serviceId,
        employeeId: credit.employeeId,
        durationOptionId: credit.durationOptionId,
        durationMinsSnapshot: credit.durationMinsSnapshot,
        deliveryTypeSnapshot: credit.deliveryTypeSnapshot,
        serviceNameSnapshot: credit.serviceNameSnapshot,
        employeeNameSnapshot: credit.employeeNameSnapshot,
        listPriceSnapshot: new Prisma.Decimal(credit.listPriceSnapshot),
        unitPriceSnapshot: new Prisma.Decimal(credit.unitPriceSnapshot),
        netValue: new Prisma.Decimal(credit.netValue),
        totalQuantity: 1,
        usedQuantity: 0,
        reservedQuantity: 0,
        constraints: { create: credit.constraints.map((constraint) => ({
          dimension: constraint.dimension,
          mode: constraint.mode,
          targets: { create: constraint.targets.map((target) => ({ targetId: target.targetId })) },
        })) },
      },
    });
  }
}
