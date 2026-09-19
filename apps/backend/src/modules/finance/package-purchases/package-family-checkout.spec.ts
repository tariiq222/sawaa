import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import {
  packagePurchaseRequestFingerprint,
  CreatePackagePurchaseHandler,
} from './create-package-purchase/create-package-purchase.handler';
import {
  selfPurchaseFingerprint,
  InitPackagePurchaseHandler,
} from './init-package-purchase/init-package-purchase.handler';

const PACKAGE_ID = '00000000-0000-4000-a000-000000000011';
const FAMILY_ID = '00000000-0000-4000-a000-000000000012';
const OTHER_FAMILY_ID = '00000000-0000-4000-a000-000000000013';
const CLIENT_ID = '00000000-0000-4000-a000-000000000014';
const BRANCH_ID = '00000000-0000-4000-a000-000000000015';

describe('package family checkout contracts', () => {
  it('keeps the old self-purchase fingerprint byte-for-byte compatible', () => {
    const command = {
      idempotencyKey: '00000000-0000-4000-a000-000000000099',
      packageId: PACKAGE_ID,
      branchId: BRANCH_ID,
      clientId: CLIENT_ID,
    };
    const oldCanonical = JSON.stringify({
      source: 'self-purchase',
      clientId: CLIENT_ID,
      packageId: PACKAGE_ID,
      branchId: BRANCH_ID,
    });
    expect(selfPurchaseFingerprint(command)).toBe(createHash('sha256').update(oldCanonical).digest('hex'));
  });

  it('includes an explicitly selected family in new fingerprints while preserving old calls', () => {
    const oldCommand = {
      packageId: PACKAGE_ID,
      clientId: CLIENT_ID,
      branchId: BRANCH_ID,
      employeeId: undefined,
      method: 'CASH' as never,
      notes: undefined,
    };
    const selectedFamily = {
      ...oldCommand,
      packageFamilyId: FAMILY_ID,
    };
    expect(packagePurchaseRequestFingerprint(oldCommand)).toBe(packagePurchaseRequestFingerprint({ ...oldCommand }));
    expect(packagePurchaseRequestFingerprint(selectedFamily as never)).not.toBe(packagePurchaseRequestFingerprint(oldCommand));
  });

  it.each([
    ['mismatched family', OTHER_FAMILY_ID],
    ['hidden option family', FAMILY_ID],
  ])('rejects checkout when the selected option is %s', async (_label, packageFamilyId) => {
    const prisma = {
      packagePurchase: { findUnique: jest.fn().mockResolvedValue(null) },
      sessionPackage: {
        findFirst: jest.fn().mockResolvedValue({
          id: PACKAGE_ID,
          familyId: FAMILY_ID,
          isPublic: true,
          isActive: true,
          family: { id: FAMILY_ID, nameAr: 'العائلة', nameEn: 'Family', isActive: packageFamilyId === FAMILY_ID, isPublic: packageFamilyId === FAMILY_ID, archivedAt: null },
          archivedAt: null,
          modelVersion: 'GROUPED_V2',
          groups: [],
          items: [],
        }),
      },
      client: { findFirst: jest.fn().mockResolvedValue({ id: CLIENT_ID }) },
    };
    const handler = new InitPackagePurchaseHandler(
      prisma as never,
      { withTransaction: jest.fn() } as never,
      { compute: jest.fn() } as never,
      {} as never,
    );

    await expect(handler.execute({
      idempotencyKey: '00000000-0000-4000-a000-000000000099',
      packageId: PACKAGE_ID,
      packageFamilyId,
      branchId: BRANCH_ID,
      clientId: CLIENT_ID,
    } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('freezes family and option names on manual purchases', async () => {
    const tx = {
      packagePurchase: { create: jest.fn().mockResolvedValue({ id: 'purchase-1' }) },
      packageCredit: { create: jest.fn() },
      invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-1' }) },
    };
    const prisma = {
      packagePurchase: { findUnique: jest.fn().mockResolvedValue(null) },
      sessionPackage: {
        findFirst: jest.fn().mockResolvedValue({
          id: PACKAGE_ID,
          familyId: FAMILY_ID,
          nameAr: 'خيار 5',
          nameEn: '5 sessions',
          isActive: true,
          archivedAt: null,
          modelVersion: 'LEGACY',
          isPublic: true,
          family: { id: FAMILY_ID, nameAr: 'العائلة', nameEn: 'Family', isActive: true, isPublic: true, archivedAt: null },
          items: [{ serviceId: null, employeeId: null, durationOptionId: null, unitPrice: 1000, paidQuantity: 5, freeQuantity: 0, discountType: null, discountValue: 0, constraints: [] }],
          groups: [],
        }),
      },
      client: { findFirst: jest.fn().mockResolvedValue({ id: CLIENT_ID }) },
    };
    const handler = new CreatePackagePurchaseHandler(
      prisma as never,
      { withTransaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) } as never,
      { compute: jest.fn().mockResolvedValue({ subtotal: 5000, discountAmount: 0, finalPrice: 5000, itemUnitPrices: [{ unitPrice: 1000 }], lines: [{ net: 5000 }] }) } as never,
      { execute: jest.fn().mockResolvedValue({ id: 'payment-1' }) } as never,
      { publishOptional: jest.fn() } as never,
    );

    await handler.execute({
      idempotencyKey: '00000000-0000-4000-a000-000000000099',
      packageId: PACKAGE_ID,
      packageFamilyId: FAMILY_ID,
      clientId: CLIENT_ID,
      branchId: BRANCH_ID,
      method: 'CASH',
    } as never);

    expect(tx.packagePurchase.create.mock.calls[0][0].data.offerSnapshot).toEqual(expect.objectContaining({
      familyId: FAMILY_ID,
      optionNameAr: 'خيار 5',
      sessionCount: 5,
    }));
  });
});
