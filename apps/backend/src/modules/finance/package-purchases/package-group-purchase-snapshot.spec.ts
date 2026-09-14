import { BadRequestException } from '@nestjs/common';
import { PackageConstraintDimension, PackageConstraintMode, Prisma } from '@prisma/client';
import {
  createGroupedPackagePurchaseSnapshot,
  issueGroupedPackageCredits,
  parseGroupedPackagePurchaseSnapshot,
  type GroupedPackagePurchaseSnapshot,
} from './package-group-purchase-snapshot';

const group = (overrides: Record<string, unknown> = {}) => ({
  key: 'first',
  label: 'First',
  serviceId: 'service-a',
  employeeId: 'employee-a',
  sequenceMode: 'ORDERED' as const,
  dependsOnGroupKey: null,
  sortOrder: 0,
  sessions: [{
    key: 'session-a', position: 0, durationOptionId: 'duration-a', deliveryType: 'IN_PERSON' as const,
    unitPrice: 10_000, durationMins: 60, listPrice: 12_000, effectivePrice: 10_000,
    serviceName: 'Service A', employeeName: 'Employee A',
  }],
  ...overrides,
});

describe('package-group-purchase-snapshot', () => {
  it('allocates the global discount in stable group and session order', () => {
    const result = createGroupedPackagePurchaseSnapshot([
      group(),
      group({
        key: 'second', label: 'Second', serviceId: 'service-b', employeeId: 'employee-b', sortOrder: 1,
        sessions: [{
          key: 'session-b', position: 0, durationOptionId: 'duration-b', deliveryType: 'ONLINE' as const,
          unitPrice: 20_000, durationMins: 45, listPrice: 22_000, effectivePrice: 20_000,
          serviceName: 'Service B', employeeName: 'Employee B',
        }],
      }),
    ], { type: 'PERCENTAGE', value: 10 });

    expect(result.price).toMatchObject({ subtotal: 30_000, discountAmount: 3_000, finalPrice: 27_000 });
    expect(result.snapshot.credits.map((credit) => credit.netValue)).toEqual([9_000, 18_000]);
    expect(result.snapshot.credits.every((credit) => credit.totalQuantity === 1)).toBe(true);
    expect(result.snapshot.credits[1]).toMatchObject({
      groupKey: 'second', sessionPosition: 0, deliveryTypeSnapshot: 'ONLINE',
      durationMinsSnapshot: 45, listPriceSnapshot: 22_000,
    });
  });

  it('keeps repeated session positions separate by group', () => {
    const result = createGroupedPackagePurchaseSnapshot([
      group(),
      group({
        key: 'second', serviceId: 'service-b', employeeId: 'employee-b', sortOrder: 1,
        sessions: [{
          key: 'session-b', position: 0, durationOptionId: 'duration-b', deliveryType: 'IN_PERSON' as const,
          unitPrice: 30_000, durationMins: 30, listPrice: 30_000, effectivePrice: 30_000,
          serviceName: 'Service B', employeeName: 'Employee B',
        }],
      }),
    ], { type: 'NONE', value: 0 });
    expect(result.snapshot.credits.map((credit) => `${credit.groupKey}:${credit.sessionPosition}`)).toEqual(['first:0', 'second:0']);
    expect(result.snapshot.credits.map((credit) => credit.unitPriceSnapshot)).toEqual([10_000, 30_000]);
  });

  it('rejects unknown versions, missing fields, non-unit quantities, and duplicate positions', () => {
    const valid = createGroupedPackagePurchaseSnapshot([group()], { type: 'NONE', value: 0 }).snapshot;
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, version: 3 } as never)).toThrow(BadRequestException);
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [{ ...valid.credits[0], serviceNameSnapshot: undefined }] } as never)).toThrow(BadRequestException);
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [{ ...valid.credits[0], totalQuantity: 2 }] } as never)).toThrow(BadRequestException);
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [...valid.credits, valid.credits[0]] } as never)).toThrow(/duplicate credit positions/i);
  });

  it('rejects credits whose identity, duration, money, or constraints are broadened', () => {
    const valid = createGroupedPackagePurchaseSnapshot([group()], { type: 'NONE', value: 0 }).snapshot;
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [{ ...valid.credits[0], employeeId: 'other' }] } as never)).toThrow(/identity|constraints/i);
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [{ ...valid.credits[0], durationMinsSnapshot: 0 }] } as never)).toThrow(/duration/i);
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [{ ...valid.credits[0], netValue: valid.credits[0].unitPriceSnapshot + 1 }] } as never)).toThrow(/money/i);
    expect(() => parseGroupedPackagePurchaseSnapshot({ ...valid, credits: [{ ...valid.credits[0], constraints: [] }] } as never)).toThrow(/constraints/i);
  });

  it('parses a complete snapshot and remaps dependencies before issuing credits', async () => {
    const source = createGroupedPackagePurchaseSnapshot([
      group({ key: 'base', sortOrder: 0 }),
      group({ key: 'follow-up', sortOrder: 1, dependsOnGroupKey: 'base' }),
    ], { type: 'FIXED', value: 1_000 });
    const snapshot = parseGroupedPackagePurchaseSnapshot(source.snapshot as unknown as Prisma.JsonValue);
    const tx = {
      packagePurchaseGroup: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'purchase-group-base' })
          .mockResolvedValueOnce({ id: 'purchase-group-follow-up' }),
        update: jest.fn().mockResolvedValue({}),
      },
      packageCredit: { create: jest.fn().mockResolvedValue({}) },
    };
    await issueGroupedPackageCredits(tx as never, 'purchase-1', snapshot);
    expect(tx.packagePurchaseGroup.create).toHaveBeenCalledTimes(2);
    expect(tx.packagePurchaseGroup.update).toHaveBeenCalledWith({
      where: { id: 'purchase-group-follow-up' },
      data: { dependsOnGroupId: 'purchase-group-base' },
    });
    expect(tx.packageCredit.create).toHaveBeenCalledTimes(2);
    const creditData = tx.packageCredit.create.mock.calls[1][0].data;
    expect(creditData).toEqual(expect.objectContaining({
      purchaseId: 'purchase-1', purchaseGroupId: 'purchase-group-follow-up', sessionPosition: 0,
      totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0,
    }));
    expect(creditData.constraints.create[0]).toEqual(expect.objectContaining({
      dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.INCLUDE,
    }));
  });

  it('rejects dependency cycles before any issuance', async () => {
    expect(() => createGroupedPackagePurchaseSnapshot([
      group({ key: 'a', dependsOnGroupKey: 'b', sortOrder: 0 }),
      group({ key: 'b', dependsOnGroupKey: 'a', sortOrder: 1 }),
    ], { type: 'NONE', value: 0 })).toThrow(/cycle/i);
  });
});
