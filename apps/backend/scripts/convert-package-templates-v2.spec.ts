import {
  applyPackageTemplateConversions,
  isProductionDatabaseName,
  parseConversionCliArgs,
  validateDatabaseUrlTarget,
  validateConversionManifest,
  validateExpectedDatabase,
  type ConversionDatabase,
} from './convert-package-templates-v2';
import { buildProtectedMapping, sourceRevision, type LegacyPackage, type OfferingEvidence } from './data-integrity/audit-package-group-conversion';

const offering: OfferingEvidence = {
  serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'duration-1',
  serviceExists: true, employeeExists: true, employeeServiceExists: true,
  employeeServiceId: 'employee-service-1', useCustomPricing: false, disabledDeliveryTypes: [],
  durationExists: true, durationMins: 60, durationDeliveryType: 'IN_PERSON',
  durationEmployeeServiceId: null, serviceDeliveryTypes: ['IN_PERSON'],
};

function source(): LegacyPackage {
  return {
    id: 'package-1', modelVersion: 'LEGACY', nameAr: 'باقة', updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    items: [{
      id: 'item-1', serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'duration-1',
      paidQuantity: 1, freeQuantity: 0,
    }],
  };
}

function manifestFor(pkg: LegacyPackage) {
  const protectedMapping = buildProtectedMapping(
    pkg,
    { subtotal: 1000, discountAmount: 0, finalPrice: 1000, lines: [{ unitPrice: 1000, net: 1000 }] },
    new Map([['item-1', offering]]),
    1,
    1,
  );
  return {
    version: 1 as const,
    database: 'sawaa_test', schema: 'public', generatedAt: new Date().toISOString(),
    mappings: [protectedMapping],
    aggregate: { packageCount: 1, readyDrafts: 1, needsOfferingSelection: 0, inconsistent: 0, purchasedRightsUnchanged: 1 },
  };
}

describe('legacy package template conversion apply guardrails', () => {
  it('requires an explicit expected database and rejects production markers', () => {
    expect(() => parseConversionCliArgs(['--output', 'manifest.json'])).toThrow(/expected-database/);
    expect(isProductionDatabaseName('sawaa-production')).toBe(true);
    expect(() => validateExpectedDatabase('sawaa-production', 'sawaa-production')).toThrow(/production/i);
    expect(() => validateExpectedDatabase('sawaa_test', 'sawaa_test')).not.toThrow();
    expect(() => validateDatabaseUrlTarget('postgresql://localhost:5432/sawaa_test', 'sawaa_test')).not.toThrow();
    expect(() => validateDatabaseUrlTarget('postgresql://localhost:5432/other_db', 'sawaa_test')).toThrow(/does not match/);
    expect(() => validateDatabaseUrlTarget('postgresql://localhost:5432/sawaa-production', 'sawaa-production')).toThrow(/production/i);
  });

  it('rejects a foreign or tampered manifest before any write', () => {
    const pkg = source();
    const manifest = manifestFor(pkg);
    expect(() => validateConversionManifest(manifest, ['foreign-package'])).toThrow(/absent/);
    expect(() => validateConversionManifest({ ...manifest, mappings: [{ ...manifest.mappings[0], sourceRevision: '0'.repeat(64) }] }, ['package-1'])).not.toThrow();
    expect(() => validateConversionManifest({ ...manifest, mappings: [{ ...manifest.mappings[0], classification: 'INCONSISTENT' }] }, ['package-1'])).toThrow(/READY_DRAFT/);
    const mixed = {
      ...manifest,
      mappings: [
        manifest.mappings[0],
        { ...manifest.mappings[0], sourcePackageId: 'needs-review', classification: 'NEEDS_OFFERING_SELECTION' as const },
      ],
    };
    expect(() => validateConversionManifest(mixed, ['package-1'])).not.toThrow();
  });

  it('replays the same provenance and creates one inactive draft on repeated apply', async () => {
    const pkg = source();
    const manifest = manifestFor(pkg);
    let draftCreates = 0;
    let provenance: { draftPackageId: string } | null = null;
    const db = {
      sessionPackage: {
        findUnique: jest.fn().mockResolvedValue(pkg),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          draftCreates += 1;
          expect(data).toMatchObject({ modelVersion: 'GROUPED_V2', isActive: false, isPublic: false, discountValue: 0 });
          return { id: 'draft-1' };
        }),
        findMany: jest.fn(),
      },
      sessionPackageGroup: { create: jest.fn().mockResolvedValue({ id: 'group-1' }) },
      sessionPackageItem: { create: jest.fn().mockResolvedValue({ id: 'item-1' }) },
      service: { findMany: jest.fn().mockResolvedValue([{ id: 'service-1', isActive: true, archivedAt: null, isHidden: false, category: null }]) },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1', isActive: true }]) },
      employeeService: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-service-1', employeeId: 'employee-1', serviceId: 'service-1', isActive: true, useCustomPricing: false, disabledDeliveryTypes: [] }]) },
      serviceDurationOption: { findMany: jest.fn().mockResolvedValue([{ id: 'duration-1', serviceId: 'service-1', employeeServiceId: null, deliveryType: 'IN_PERSON', durationMins: 60, price: 1000, isActive: true }]), findFirst: jest.fn().mockResolvedValue({ id: 'duration-1', serviceId: 'service-1', employeeServiceId: null, deliveryType: 'IN_PERSON', durationMins: 60, price: 1000, currency: 'SAR', isActive: true }) },
      serviceBookingConfig: { findMany: jest.fn().mockResolvedValue([{ serviceId: 'service-1', deliveryType: 'IN_PERSON', isActive: true }]), findFirst: jest.fn().mockResolvedValue(null) },
      employeeServiceOption: { findFirst: jest.fn().mockResolvedValue(null) },
      packagePurchase: { findMany: jest.fn().mockResolvedValue([{ id: 'purchase-1', packageId: 'package-1' }]) },
      packageCredit: { findMany: jest.fn().mockResolvedValue([{ id: 'credit-1', purchaseId: 'purchase-1' }]) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      packageTemplateConversion: {
        findUnique: jest.fn().mockImplementation(async () => provenance),
        create: jest.fn().mockImplementation(async ({ data }: { data: { draftPackageId: string } }) => {
          provenance = { draftPackageId: data.draftPackageId };
          return provenance;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: ConversionDatabase) => Promise<unknown>) => fn(db as unknown as ConversionDatabase)),
    } as unknown as ConversionDatabase;
    const pricePackage = async () => ({ subtotal: 1000, discountAmount: 0, finalPrice: 1000, lines: [{ unitPrice: 1000, net: 1000 }] });
    const first = await applyPackageTemplateConversions(db, manifest, { selectedSourcePackageIds: ['package-1'], pricePackage, offerings: new Map([['item-1', offering]]), expectedDatabase: 'sawaa_test', database: 'sawaa_test' });
    const second = await applyPackageTemplateConversions(db, manifest, { selectedSourcePackageIds: ['package-1'], pricePackage, offerings: new Map([['item-1', offering]]), expectedDatabase: 'sawaa_test', database: 'sawaa_test' });
    expect(first).toEqual([{ sourcePackageId: 'package-1', sourceRevision: sourceRevision(pkg), draftPackageId: 'draft-1', replayed: false, classification: 'READY_DRAFT' }]);
    expect(second[0]).toMatchObject({ draftPackageId: 'draft-1', replayed: true });
    expect(draftCreates).toBe(1);
  });

  it('rejects a stale source revision before creating a draft', async () => {
    const pkg = source();
    const manifest = manifestFor(pkg);
    const changed = { ...pkg, updatedAt: new Date('2026-09-13T00:00:01.000Z') };
    const db = {
      sessionPackage: { findUnique: jest.fn().mockResolvedValue(changed), create: jest.fn(), findMany: jest.fn() },
      sessionPackageGroup: { create: jest.fn() }, sessionPackageItem: { create: jest.fn() },
      packageTemplateConversion: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
      packageCredit: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (fn: (tx: ConversionDatabase) => Promise<unknown>) => fn(db as unknown as ConversionDatabase)),
    } as unknown as ConversionDatabase;
    await expect(applyPackageTemplateConversions(db, manifest, { selectedSourcePackageIds: ['package-1'], pricePackage: async () => ({ subtotal: 0, discountAmount: 0, finalPrice: 0, lines: [] }), offerings: new Map(), expectedDatabase: 'sawaa_test', database: 'sawaa_test' })).rejects.toThrow(/Stale source revision/);
    expect(db.sessionPackage.create).not.toHaveBeenCalled();
  });
});
