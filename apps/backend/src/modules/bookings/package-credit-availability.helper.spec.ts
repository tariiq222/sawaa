import { getPackageCreditAvailability } from './package-credit-availability.helper';

const delivered = (id: string, sessionPosition: number) => ({
  id,
  sessionPosition,
  totalQuantity: 1,
  usedQuantity: 1,
  reservedQuantity: 0,
  usages: [{ status: 'CONSUMED' as const, deliveredAt: new Date() }],
});

describe('grouped package credit availability', () => {
  it('keeps the next ordered session locked through reserve/check-in and opens it after delivery', () => {
    const predecessor = {
      id: 'first', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0,
      reservedQuantity: 1,
      usages: [{ status: 'RESERVED' as 'RESERVED' | 'CONSUMED', deliveredAt: null as Date | null }],
    };
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'ORDERED', sessionPosition: 1,
      creditId: 'second', purchaseGroupId: 'group-1',
      groupCredits: [predecessor, { id: 'second', sessionPosition: 1, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
    })).toEqual({ bookable: false, reason: 'PREDECESSOR_INCOMPLETE' });
    predecessor.usedQuantity = 1;
    predecessor.reservedQuantity = 0;
    predecessor.usages[0] = { status: 'CONSUMED', deliveredAt: null };
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'ORDERED', sessionPosition: 1,
      creditId: 'second', purchaseGroupId: 'group-1',
      groupCredits: [predecessor, { id: 'second', sessionPosition: 1, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
    })).toEqual({ bookable: false, reason: 'PREDECESSOR_INCOMPLETE' });
    predecessor.usages[0].deliveredAt = new Date();
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'ORDERED', sessionPosition: 1,
      creditId: 'second', purchaseGroupId: 'group-1',
      groupCredits: [predecessor, { id: 'second', sessionPosition: 1, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
    })).toEqual({ bookable: true, reason: null });
  });

  it('allows unordered sessions and blocks a dependent group until all dependency credits deliver', () => {
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'UNORDERED', sessionPosition: 0,
      creditId: 'independent', purchaseGroupId: 'group-independent',
      groupCredits: [{ id: 'independent', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
    })).toEqual({ bookable: true, reason: null });
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'UNORDERED', sessionPosition: 0,
      creditId: 'dependent-1', purchaseGroupId: 'group-dependent',
      groupCredits: [{ id: 'dependent-1', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
      dependsOnGroupId: 'dependency', dependencyCredits: [
        { id: 'dependency-1', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] },
      ],
    })).toEqual({ bookable: false, reason: 'DEPENDENCY_INCOMPLETE' });
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'UNORDERED', sessionPosition: 0,
      creditId: 'dependent-1', purchaseGroupId: 'group-dependent',
      groupCredits: [{ id: 'dependent-1', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
      dependsOnGroupId: 'dependency', dependencyCredits: [delivered('dependency-1', 0)],
    })).toEqual({ bookable: true, reason: null });
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'UNORDERED', sessionPosition: 0,
      creditId: 'dependent-1', purchaseGroupId: 'group-dependent',
      groupCredits: [{ id: 'dependent-1', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
      dependsOnGroupId: 'dependency',
    })).toEqual({ bookable: false, reason: 'GROUP_INCOMPLETE' });
  });

  it('returns stable reason codes for capacity, refund, and offering gates', () => {
    expect(getPackageCreditAvailability({ modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1, usedQuantity: 0, reservedQuantity: 1 })).toEqual({ bookable: false, reason: 'RESERVED' });
    expect(getPackageCreditAvailability({ modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1, usedQuantity: 1, reservedQuantity: 0, usages: [{ status: 'CONSUMED', deliveredAt: new Date() }] })).toEqual({ bookable: false, reason: 'DELIVERED' });
    expect(getPackageCreditAvailability({ modelVersion: 'GROUPED_V2', purchaseStatus: 'REFUNDED', totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0 })).toEqual({ bookable: false, reason: 'REFUNDED' });
    expect(getPackageCreditAvailability({ modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, offeringAvailable: false })).toEqual({ bookable: false, reason: 'OFFERING_UNAVAILABLE' });
  });

  it('fails closed for malformed grouped topology and inactive purchases', () => {
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0,
      sequenceMode: 'UNORDERED', sessionPosition: 0, purchaseGroupId: 'group-1', creditId: 'credit-1',
      groupCredits: [{ id: 'credit-1', sessionPosition: 0, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0 }],
    })).toEqual({ bookable: false, reason: 'PURCHASE_INACTIVE' });
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0, sequenceMode: 'ORDERED', sessionPosition: 1,
      purchaseGroupId: 'group-1', creditId: 'credit-2',
      groupCredits: [{ id: 'credit-2', sessionPosition: 1, totalQuantity: 1, usedQuantity: 0, reservedQuantity: 0, usages: [] }],
    })).toEqual({ bookable: false, reason: 'GROUP_INCOMPLETE' });
    expect(getPackageCreditAvailability({
      modelVersion: 'GROUPED_V2', purchaseStatus: 'PENDING', totalQuantity: 1,
      usedQuantity: 0, reservedQuantity: 0,
    })).toEqual({ bookable: false, reason: 'PURCHASE_INACTIVE' });
  });

  it('distinguishes a consumed but not delivered credit from a delivered credit', () => {
    expect(getPackageCreditAvailability({
      modelVersion: 'LEGACY', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 1, reservedQuantity: 0,
      usages: [{ status: 'CONSUMED', deliveredAt: null }],
    })).toEqual({ bookable: false, reason: 'CONSUMED' });
    expect(getPackageCreditAvailability({
      modelVersion: 'LEGACY', purchaseStatus: 'ACTIVE', totalQuantity: 1,
      usedQuantity: 1, reservedQuantity: 0,
      usages: [{ status: 'CONSUMED', deliveredAt: new Date() }],
    })).toEqual({ bookable: false, reason: 'DELIVERED' });
  });
});
