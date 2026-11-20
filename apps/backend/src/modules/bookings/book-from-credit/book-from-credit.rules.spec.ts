import { BadRequestException, ConflictException } from '@nestjs/common';
import { DeliveryType } from '@prisma/client';
import {
  assertScheduledInFuture,
  assertTargetSelection,
  hasAvailableCapacity,
  mapConcurrentCreditConflict,
  resolveCreditRouting,
} from './book-from-credit.rules';

const durationOption = { durationMins: 50 };
const clinicEligibility = { deliveryType: DeliveryType.IN_PERSON };

describe('book-from-credit rules', () => {
  describe('hasAvailableCapacity', () => {
    it('counts reserved sessions as occupied', () => {
      expect(hasAvailableCapacity({ totalQuantity: 5, usedQuantity: 0, reservedQuantity: 5 })).toBe(false);
      expect(hasAvailableCapacity({ totalQuantity: 5, usedQuantity: 4, reservedQuantity: 1 })).toBe(false);
      expect(hasAvailableCapacity({ totalQuantity: 5, usedQuantity: 4, reservedQuantity: 0 })).toBe(true);
    });

    it('treats a missing reservedQuantity as zero', () => {
      expect(hasAvailableCapacity({ totalQuantity: 1, usedQuantity: 0 })).toBe(true);
      expect(hasAvailableCapacity({ totalQuantity: 1, usedQuantity: 1 })).toBe(false);
    });
  });

  describe('resolveCreditRouting', () => {
    it('derives duration and delivery from the live option for a legacy credit', () => {
      expect(
        resolveCreditRouting({
          credit: { durationMinsSnapshot: null, deliveryTypeSnapshot: null },
          durationOption,
          eligibility: clinicEligibility,
        }),
      ).toEqual({ isGroupedV2: false, durationMins: 50, deliveryType: DeliveryType.IN_PERSON });
    });

    it('uses the frozen snapshot for a grouped credit', () => {
      expect(
        resolveCreditRouting({
          credit: {
            durationMinsSnapshot: 60,
            deliveryTypeSnapshot: DeliveryType.ONLINE,
            purchase: { modelVersion: 'GROUPED_V2' },
          },
          durationOption: { durationMins: 60 },
          eligibility: { deliveryType: DeliveryType.ONLINE },
        }),
      ).toEqual({ isGroupedV2: true, durationMins: 60, deliveryType: DeliveryType.ONLINE });
    });

    it('rejects an incomplete grouped snapshot', () => {
      expect(() =>
        resolveCreditRouting({
          credit: {
            durationMinsSnapshot: null,
            deliveryTypeSnapshot: DeliveryType.ONLINE,
            purchase: { modelVersion: 'GROUPED_V2' },
          },
          durationOption,
          eligibility: clinicEligibility,
        }),
      ).toThrow(new BadRequestException('Grouped package credit snapshot is incomplete'));
    });

    it('rejects a grouped credit whose practitioner offering changed', () => {
      expect(() =>
        resolveCreditRouting({
          credit: {
            durationMinsSnapshot: 60,
            deliveryTypeSnapshot: DeliveryType.ONLINE,
            purchase: { modelVersion: 'GROUPED_V2' },
          },
          durationOption: { durationMins: 50 },
          eligibility: { deliveryType: DeliveryType.ONLINE },
        }),
      ).toThrow(
        new BadRequestException(
          'Current practitioner offering no longer matches the package credit snapshot',
        ),
      );
    });

    it('rejects a requested delivery that differs from the credit snapshot', () => {
      expect(() =>
        resolveCreditRouting({
          credit: {
            durationMinsSnapshot: 60,
            deliveryTypeSnapshot: DeliveryType.ONLINE,
            purchase: { modelVersion: 'GROUPED_V2' },
          },
          durationOption: { durationMins: 60 },
          eligibility: { deliveryType: DeliveryType.ONLINE },
          requestedDeliveryType: DeliveryType.IN_PERSON,
        }),
      ).toThrow(new BadRequestException('Delivery type does not match the package credit snapshot'));
    });
  });

  describe('assertScheduledInFuture', () => {
    const now = new Date('2026-11-20T10:00:00Z');

    it('accepts a strictly future slot', () => {
      expect(() => assertScheduledInFuture(new Date('2026-11-20T10:00:01Z'), now)).not.toThrow();
    });

    it('rejects the current instant and the past', () => {
      expect(() => assertScheduledInFuture(now, now)).toThrow(BadRequestException);
      expect(() => assertScheduledInFuture(new Date('2026-11-20T09:59:59Z'), now)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertTargetSelection', () => {
    it('accepts a creditId, or the full triple, or both', () => {
      expect(() => assertTargetSelection({ creditId: 'c-1' })).not.toThrow();
      expect(() =>
        assertTargetSelection({ serviceId: 's-1', employeeId: 'e-1', durationOptionId: 'd-1' }),
      ).not.toThrow();
      expect(() =>
        assertTargetSelection({
          creditId: 'c-1',
          serviceId: 's-1',
          employeeId: 'e-1',
          durationOptionId: 'd-1',
        }),
      ).not.toThrow();
    });

    it('rejects neither a creditId nor a triple', () => {
      expect(() => assertTargetSelection({})).toThrow(BadRequestException);
      expect(() =>
        assertTargetSelection({ serviceId: 's-1', employeeId: 'e-1' }),
      ).toThrow(BadRequestException);
    });

    it('rejects a creditId plus a partial triple instead of silently falling back', () => {
      expect(() => assertTargetSelection({ creditId: 'c-1', serviceId: 's-1' })).toThrow(
        new BadRequestException(
          'Provide all of serviceId, employeeId and durationOptionId when selecting a credit target',
        ),
      );
      expect(() =>
        assertTargetSelection({ creditId: 'c-1', serviceId: 's-1', employeeId: 'e-1' }),
      ).toThrow(BadRequestException);
    });
  });

  describe('mapConcurrentCreditConflict', () => {
    it('maps a Prisma P2034 serialization abort to a 409', () => {
      const error = Object.assign(new Error('write conflict'), { code: 'P2034' });
      expect(() => mapConcurrentCreditConflict(error)).toThrow(ConflictException);
      expect(() => mapConcurrentCreditConflict(error)).toThrow(
        'Package credit was consumed concurrently; please retry',
      );
    });

    it('rethrows an unrelated error unchanged', () => {
      const error = new Error('boom');
      expect(() => mapConcurrentCreditConflict(error)).toThrow(error);
      expect(() => mapConcurrentCreditConflict(error)).not.toThrow(ConflictException);
    });
  });
});
