import { PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';

/**
 * Builds the Prisma nested-create payload that snapshots a package item's
 * eligibility constraints onto a PackageCredit at purchase/activation time.
 *
 * When the item already carries explicit constraints (flexible or backfilled
 * legacy items) they are copied verbatim. When it has none (a package created
 * before constraint authoring landed), INCLUDE constraints are synthesised from
 * the item's legacy triple so every issued credit is self-contained.
 */

export interface ItemConstraintInput {
  dimension: PackageConstraintDimension;
  mode: PackageConstraintMode;
  targets: { targetId: string }[];
}

export interface CreditSourceItem {
  serviceId?: string | null;
  employeeId?: string | null;
  durationOptionId?: string | null;
  constraints?: ItemConstraintInput[];
}

function synthesizeFromTriple(item: CreditSourceItem): ItemConstraintInput[] {
  const out: ItemConstraintInput[] = [];
  if (item.serviceId) {
    out.push({
      dimension: PackageConstraintDimension.SERVICE,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: item.serviceId }],
    });
  }
  if (item.employeeId) {
    out.push({
      dimension: PackageConstraintDimension.PRACTITIONER,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: item.employeeId }],
    });
  }
  if (item.durationOptionId) {
    out.push({
      dimension: PackageConstraintDimension.DURATION,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: item.durationOptionId }],
    });
  }
  return out;
}

/** Returns the value for `PackageCredit.create({ data: { constraints: { create } } })`. */
export function buildCreditConstraintCreate(item: CreditSourceItem) {
  const source =
    item.constraints && item.constraints.length > 0
      ? item.constraints
      : synthesizeFromTriple(item);
  return source.map((c) => ({
    dimension: c.dimension,
    mode: c.mode,
    targets: { create: c.targets.map((t) => ({ targetId: t.targetId })) },
  }));
}
