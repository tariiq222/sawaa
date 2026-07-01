import { PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';

/**
 * Rule-based package-credit matching.
 *
 * A package credit is eligible for a booking when, for EVERY constrained
 * dimension (service, practitioner, duration, delivery type), the booking's
 * value passes the constraint:
 *   - ANY      → always passes (a dimension with no constraint row is ANY too);
 *   - INCLUDE  → the value must be one of the constraint's targets;
 *   - EXCLUDE  → the value must NOT be one of the constraint's targets.
 *
 * This replaces the old rigid (serviceId, employeeId, durationOptionId) equality
 * match. Legacy credits are represented as three INCLUDE constraints (one target
 * each); flexible credits mix ANY / INCLUDE / EXCLUDE across dimensions.
 */

/** One constraint dimension with its mode and target values. */
export interface CreditConstraint {
  dimension: PackageConstraintDimension;
  mode: PackageConstraintMode;
  targets: { targetId: string }[];
}

/** The concrete booking a client is trying to make. */
export interface BookingTarget {
  serviceId: string;
  employeeId: string;
  durationOptionId: string;
  deliveryType?: string | null;
}

/** A credit as far as matching cares: its snapshot constraints + legacy triple. */
export interface MatchableCredit {
  constraints: CreditConstraint[];
  serviceId?: string | null;
  employeeId?: string | null;
  durationOptionId?: string | null;
}

function dimensionValue(
  target: BookingTarget,
  dimension: PackageConstraintDimension,
): string | null {
  switch (dimension) {
    case PackageConstraintDimension.SERVICE:
      return target.serviceId;
    case PackageConstraintDimension.PRACTITIONER:
      return target.employeeId;
    case PackageConstraintDimension.DURATION:
      return target.durationOptionId;
    case PackageConstraintDimension.DELIVERY_TYPE:
      return target.deliveryType ?? null;
    default:
      return null;
  }
}

function dimensionPasses(
  value: string | null,
  mode: PackageConstraintMode,
  targetIds: string[],
): boolean {
  if (mode === PackageConstraintMode.ANY) return true;
  // INCLUDE/EXCLUDE need a concrete value to compare against.
  if (value == null) return false;
  if (mode === PackageConstraintMode.INCLUDE) return targetIds.includes(value);
  if (mode === PackageConstraintMode.EXCLUDE) return !targetIds.includes(value);
  return false;
}

/**
 * The constraints that actually govern a credit. When a credit has snapshot
 * constraints, those win. When it has none (a credit issued before constraint
 * snapshotting, or a defensive fallback), synthesise INCLUDE constraints from
 * its legacy triple so matching still behaves like the old equality match.
 */
export function effectiveConstraints(credit: MatchableCredit): CreditConstraint[] {
  if (credit.constraints.length > 0) return credit.constraints;
  const synthetic: CreditConstraint[] = [];
  if (credit.serviceId) {
    synthetic.push({
      dimension: PackageConstraintDimension.SERVICE,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: credit.serviceId }],
    });
  }
  if (credit.employeeId) {
    synthetic.push({
      dimension: PackageConstraintDimension.PRACTITIONER,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: credit.employeeId }],
    });
  }
  if (credit.durationOptionId) {
    synthetic.push({
      dimension: PackageConstraintDimension.DURATION,
      mode: PackageConstraintMode.INCLUDE,
      targets: [{ targetId: credit.durationOptionId }],
    });
  }
  return synthetic;
}

/** True when the booking target satisfies every one of the credit's constraints. */
export function creditMatchesTarget(
  credit: MatchableCredit,
  target: BookingTarget,
): boolean {
  for (const c of effectiveConstraints(credit)) {
    const value = dimensionValue(target, c.dimension);
    if (!dimensionPasses(value, c.mode, c.targets.map((t) => t.targetId))) {
      return false;
    }
  }
  return true;
}

/**
 * Consumption priority: the NARROWER credit is consumed first, protecting the
 * client's broad "any" credits from being burned while a specific one still
 * applies. Score = number of non-ANY (constrained) dimensions; higher = narrower.
 */
export function specificityScore(credit: MatchableCredit): number {
  return effectiveConstraints(credit).filter(
    (c) => c.mode !== PackageConstraintMode.ANY,
  ).length;
}
