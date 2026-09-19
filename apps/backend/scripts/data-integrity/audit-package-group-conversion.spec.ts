import {
  buildDraftPreview,
  buildProtectedMapping,
  classifyLegacyItem,
  auditPackageTemplates,
  sourceRevision,
  type LegacyPackage,
  type LegacyPackagePrice,
  type OfferingEvidence,
} from './audit-package-group-conversion';

const evidence: OfferingEvidence = {
  serviceId: 'service-1',
  employeeId: 'employee-1',
  durationOptionId: 'duration-1',
  serviceExists: true,
  employeeExists: true,
  employeeServiceExists: true,
  employeeServiceId: 'employee-service-1',
  useCustomPricing: false,
  disabledDeliveryTypes: [],
  durationExists: true,
  durationMins: 60,
  durationDeliveryType: 'IN_PERSON',
  durationEmployeeServiceId: null,
  serviceDeliveryTypes: ['IN_PERSON'],
};

function packageFixture(overrides: Partial<LegacyPackage> = {}): LegacyPackage {
  return {
    id: 'package-1',
    modelVersion: 'LEGACY',
    nameAr: 'باقة قديمة',
    nameEn: 'Legacy package',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    updatedAt: new Date('2026-09-13T00:00:00.000Z'),
    items: [{
      id: 'item-1',
      sortOrder: 0,
      serviceId: 'service-1',
      employeeId: 'employee-1',
      durationOptionId: 'duration-1',
      paidQuantity: 5,
      freeQuantity: 1,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      constraints: [
        { dimension: 'SERVICE', mode: 'INCLUDE', targets: [{ targetId: 'service-1' }] },
        { dimension: 'PRACTITIONER', mode: 'INCLUDE', targets: [{ targetId: 'employee-1' }] },
        { dimension: 'DURATION', mode: 'INCLUDE', targets: [{ targetId: 'duration-1' }] },
        { dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'IN_PERSON' }] },
      ],
    }],
    ...overrides,
  };
}

describe('legacy package group conversion audit', () => {
  it('preserves exact net money while expanding five paid and one free right', () => {
    const pkg = packageFixture();
    const prices: LegacyPackagePrice = {
      subtotal: 5555,
      discountAmount: 111,
      finalPrice: 5444,
      lines: [{ unitPrice: 1111, net: 5444 }],
    };
    const preview = buildDraftPreview(pkg, prices, new Map([['item-1', evidence]]));
    const sessions = preview.groups[0].sessions;
    expect(sessions).toHaveLength(6);
    expect(sessions.filter((session) => !session.free).reduce((sum, session) => sum + session.unitPrice, 0)).toBe(5444);
    expect(sessions.filter((session) => session.free).every((session) => session.unitPrice === 0)).toBe(true);
    expect(preview.totalRights).toBe(6);
    expect(preview.globalDiscount).toEqual({ type: 'NONE', value: 0 });
  });

  it('classifies flexible ANY and EXCLUDE constraints for explicit offering selection', () => {
    expect(classifyLegacyItem({
      id: 'flexible', paidQuantity: 1, freeQuantity: 0,
      constraints: [{ dimension: 'PRACTITIONER', mode: 'ANY', targets: [] }],
    })).toEqual({ classification: 'NEEDS_OFFERING_SELECTION', reasons: ['FLEXIBLE_OR_EXCLUSION_CONSTRAINT', 'MISSING_CONCRETE_OFFERING'] });
    expect(classifyLegacyItem({
      id: 'excluded', paidQuantity: 1, freeQuantity: 0,
      serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'duration-1',
      constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'EXCLUDE', targets: [{ targetId: 'ONLINE' }] }],
    }, evidence).classification).toBe('NEEDS_OFFERING_SELECTION');
  });

  it('classifies missing or contradictory offering references as inconsistent', () => {
    expect(classifyLegacyItem({
      id: 'missing', paidQuantity: 1, freeQuantity: 0,
      serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'missing-duration',
    }, { ...evidence, durationExists: false })).toEqual({ classification: 'INCONSISTENT', reasons: ['MISSING_OR_INVALID_DURATION'] });
    expect(classifyLegacyItem({
      id: 'contradictory', paidQuantity: 1, freeQuantity: 0,
      serviceId: 'service-1', employeeId: 'employee-1', durationOptionId: 'duration-1',
      constraints: [{ dimension: 'SERVICE', mode: 'INCLUDE', targets: [{ targetId: 'other-service' }] }],
    }, evidence).classification).toBe('INCONSISTENT');
  });

  it('changes revision when any complete source definition value changes', () => {
    const original = packageFixture();
    const changed = packageFixture({ updatedAt: new Date('2026-09-13T00:00:01.000Z') });
    expect(sourceRevision(original)).toMatch(/^[a-f0-9]{64}$/);
    expect(sourceRevision(changed)).not.toBe(sourceRevision(original));
  });

  it('canonicalizes constraint and target order without rounding fractional discounts', async () => {
    const original = packageFixture();
    const reordered = packageFixture({ items: [{
      ...original.items[0],
      constraints: [...(original.items[0].constraints ?? [])].reverse().map((constraint) => ({
        ...constraint,
        targets: [...(constraint.targets ?? [])].reverse(),
      })),
    }] });
    expect(sourceRevision(reordered)).toBe(sourceRevision(original));
    const executeRaw = jest.fn().mockResolvedValue(undefined);
    const serviceFindMany = jest.fn().mockResolvedValue([{
      id: 'service-1', isActive: true, archivedAt: null, isHidden: false,
      category: { isActive: true, bookingMode: 'SERVICES' },
    }]);
    const pkg = packageFixture({ discountValue: 12.5 });
    const db = {
      sessionPackage: { findMany: jest.fn().mockResolvedValue([pkg]) },
      packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
      packageCredit: { findMany: jest.fn().mockResolvedValue([]) },
      service: {
        findMany: serviceFindMany,
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'service-1', price: 1000, durationMins: 60, currency: 'SAR' }),
      },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: 'employee-1', isActive: true }]) },
      employeeService: { findMany: jest.fn().mockResolvedValue([{
        id: 'employee-service-1', employeeId: 'employee-1', serviceId: 'service-1', isActive: true,
        useCustomPricing: false, disabledDeliveryTypes: [],
      }]) },
      serviceDurationOption: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'duration-1', serviceId: 'service-1', employeeServiceId: null,
          deliveryType: 'IN_PERSON', durationMins: 60, price: 1000, isActive: true,
        }]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'duration-1', serviceId: 'service-1', employeeServiceId: null,
          deliveryType: 'IN_PERSON', durationMins: 60, price: 1000, currency: 'SAR', isActive: true,
        }),
      },
      serviceBookingConfig: {
        findMany: jest.fn().mockResolvedValue([{ serviceId: 'service-1', deliveryType: 'IN_PERSON', isActive: true }]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      employeeServiceOption: { findFirst: jest.fn().mockResolvedValue(null) },
      $executeRaw: executeRaw,
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
        ...db, $executeRaw: executeRaw,
      })),
    } as never;
    const pricePackage = jest.fn(async (input: LegacyPackage) => {
      expect(input.discountValue).toBe(12.5);
      return { subtotal: 1000, discountAmount: 125, finalPrice: 875, lines: [{ unitPrice: 200, net: 875 }] };
    });
    const manifest = await auditPackageTemplates(db, { pricePackage, offerings: new Map([['item-1', evidence]]) });
    expect(manifest.mappings[0].classification).toBe('READY_DRAFT');
    expect(pricePackage).toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it('classifies missing prices or empty templates without fabricating zero money', () => {
    const missingPrice = buildProtectedMapping(packageFixture(), null, new Map([['item-1', evidence]]));
    expect(missingPrice.classification).toBe('INCONSISTENT');
    expect(missingPrice.reasons).toContain('PRICE_UNRESOLVED');
    expect(missingPrice.before.finalPrice).toBeNull();
    const empty = buildProtectedMapping({ ...packageFixture(), items: [] }, null, new Map());
    expect(empty.classification).toBe('INCONSISTENT');
    expect(empty.reasons).toContain('EMPTY_TEMPLATE');
  });

  it('reports purchased rights as unchanged alongside a ready draft mapping', () => {
    const mapping = buildProtectedMapping(
      packageFixture(),
      { subtotal: 5000, discountAmount: 0, finalPrice: 5000, lines: [{ unitPrice: 1000, net: 5000 }] },
      new Map([['item-1', evidence]]),
      2,
      6,
    );
    expect(mapping.classification).toBe('READY_DRAFT');
    expect(mapping.purchasedRights).toEqual({
      classification: 'LEGACY_PURCHASE_UNCHANGED',
      purchaseCount: 2,
      creditCount: 6,
    });
    expect(mapping.after?.totalRights).toBe(6);
  });
});
