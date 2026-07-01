import { PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';
import {
  creditMatchesTarget,
  effectiveConstraints,
  specificityScore,
  type BookingTarget,
  type MatchableCredit,
} from './package-credit-matching.helper';

const { SERVICE, PRACTITIONER, DURATION, DELIVERY_TYPE } = PackageConstraintDimension;
const { ANY, INCLUDE, EXCLUDE } = PackageConstraintMode;

const target: BookingTarget = {
  serviceId: 'svc-1',
  employeeId: 'emp-1',
  durationOptionId: 'dur-1',
  deliveryType: 'IN_PERSON',
};

const inc = (dimension: PackageConstraintDimension, ...ids: string[]) => ({
  dimension,
  mode: INCLUDE,
  targets: ids.map((targetId) => ({ targetId })),
});
const exc = (dimension: PackageConstraintDimension, ...ids: string[]) => ({
  dimension,
  mode: EXCLUDE,
  targets: ids.map((targetId) => ({ targetId })),
});
const any = (dimension: PackageConstraintDimension) => ({ dimension, mode: ANY, targets: [] });

const credit = (constraints: MatchableCredit['constraints']): MatchableCredit => ({ constraints });

describe('package-credit-matching', () => {
  describe('creditMatchesTarget', () => {
    it('legacy exact triple (3 INCLUDE) matches the same target', () => {
      expect(
        creditMatchesTarget(
          credit([inc(SERVICE, 'svc-1'), inc(PRACTITIONER, 'emp-1'), inc(DURATION, 'dur-1')]),
          target,
        ),
      ).toBe(true);
    });

    it('INCLUDE fails when the value is not in the target list', () => {
      expect(creditMatchesTarget(credit([inc(PRACTITIONER, 'emp-2')]), target)).toBe(false);
    });

    it('ANY practitioner matches any employee', () => {
      expect(
        creditMatchesTarget(credit([inc(SERVICE, 'svc-1'), any(PRACTITIONER)]), target),
      ).toBe(true);
    });

    it('an absent dimension behaves like ANY', () => {
      // only a SERVICE constraint → practitioner/duration are unconstrained.
      expect(creditMatchesTarget(credit([inc(SERVICE, 'svc-1')]), target)).toBe(true);
    });

    it('EXCLUDE blocks a listed value and allows an unlisted one', () => {
      expect(creditMatchesTarget(credit([exc(PRACTITIONER, 'emp-1')]), target)).toBe(false);
      expect(creditMatchesTarget(credit([exc(PRACTITIONER, 'emp-9')]), target)).toBe(true);
    });

    it('INCLUDE with multiple targets matches any of them', () => {
      expect(
        creditMatchesTarget(credit([inc(SERVICE, 'svc-1', 'svc-2', 'svc-3')]), target),
      ).toBe(true);
    });

    it('DELIVERY_TYPE constraint is enforced', () => {
      expect(creditMatchesTarget(credit([inc(DELIVERY_TYPE, 'ONLINE')]), target)).toBe(false);
      expect(creditMatchesTarget(credit([inc(DELIVERY_TYPE, 'IN_PERSON')]), target)).toBe(true);
    });

    it('INCLUDE/EXCLUDE cannot match when the target value is missing', () => {
      const noDelivery: BookingTarget = { ...target, deliveryType: null };
      expect(creditMatchesTarget(credit([inc(DELIVERY_TYPE, 'IN_PERSON')]), noDelivery)).toBe(false);
      // EXCLUDE also fails on a missing value (cannot prove it is not excluded).
      expect(creditMatchesTarget(credit([exc(DELIVERY_TYPE, 'ONLINE')]), noDelivery)).toBe(false);
    });

    it('all dimensions must pass (AND semantics)', () => {
      expect(
        creditMatchesTarget(credit([inc(SERVICE, 'svc-1'), inc(PRACTITIONER, 'emp-2')]), target),
      ).toBe(false);
    });
  });

  describe('effectiveConstraints', () => {
    it('synthesises INCLUDE constraints from the legacy triple when none are stored', () => {
      const result = effectiveConstraints({
        constraints: [],
        serviceId: 'svc-1',
        employeeId: 'emp-1',
        durationOptionId: 'dur-1',
      });
      expect(result).toHaveLength(3);
      expect(result.every((c) => c.mode === INCLUDE)).toBe(true);
      // and a target with the same triple matches the synthesised set.
      expect(
        creditMatchesTarget(
          { constraints: [], serviceId: 'svc-1', employeeId: 'emp-1', durationOptionId: 'dur-1' },
          target,
        ),
      ).toBe(true);
    });

    it('prefers stored constraints over the legacy triple', () => {
      const result = effectiveConstraints({
        constraints: [any(PRACTITIONER)],
        serviceId: 'svc-1',
        employeeId: 'emp-1',
        durationOptionId: 'dur-1',
      });
      expect(result).toEqual([any(PRACTITIONER)]);
    });
  });

  describe('specificityScore', () => {
    it('counts only non-ANY dimensions (narrower = higher)', () => {
      expect(
        specificityScore(credit([inc(SERVICE, 'svc-1'), inc(PRACTITIONER, 'emp-1'), inc(DURATION, 'dur-1')])),
      ).toBe(3);
      expect(specificityScore(credit([inc(SERVICE, 'svc-1'), any(PRACTITIONER), any(DURATION)]))).toBe(1);
      expect(specificityScore(credit([exc(PRACTITIONER, 'emp-9')]))).toBe(1);
    });
  });
});
