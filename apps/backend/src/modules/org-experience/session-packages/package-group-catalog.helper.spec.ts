import { applyGroupedPackagePrice, decorateGroupedPackage } from './package-group-catalog.helper';

const packageFixture = {
  modelVersion: 'GROUPED_V2',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  groups: [{
    id: 'g1', key: 'first', serviceId: 'service-1', employeeId: 'employee-1', sequenceMode: 'ORDERED' as const,
    dependsOnGroupId: null, sortOrder: 0,
    items: [
      { id: 'i1', groupId: 'g1', sessionPosition: 0, durationOptionId: 'duration-1', unitPrice: 30000, constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'ONLINE' }] }] },
      { id: 'i2', groupId: 'g1', sessionPosition: 1, durationOptionId: 'duration-2', unitPrice: 10000, constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'IN_PERSON' }] }] },
    ],
  }],
};

describe('grouped package catalog helpers', () => {
  it('decorates stable item keys and dependencies for editor responses', () => {
    const decorated = decorateGroupedPackage(packageFixture as never);
    expect(decorated.groups[0]).toEqual(expect.objectContaining({
      key: 'first', dependsOnGroupKey: null,
      sessions: [
        expect.objectContaining({ key: 'i1', position: 0, deliveryType: 'ONLINE', unitPrice: 30000 }),
        expect.objectContaining({ key: 'i2', position: 1, deliveryType: 'IN_PERSON', unitPrice: 10000 }),
      ],
    }));
  });

  it('uses one global discount allocation for all V2 sessions', () => {
    const price = applyGroupedPackagePrice(packageFixture as never, {
      subtotal: 0, discountAmount: 0, finalPrice: 0, fullValue: 0, freeValue: 0, itemUnitPrices: [], lines: [],
    });
    expect(price.subtotal).toBe(40000);
    expect(price.discountAmount).toBe(4000);
    expect(price.finalPrice).toBe(36000);
    expect(price.lines.map((line) => line.net)).toEqual([27000, 9000]);
  });

  it('returns legacy pricing untouched', () => {
    const legacy = { subtotal: 1, discountAmount: 2, finalPrice: 3, fullValue: 4, freeValue: 5, itemUnitPrices: [], lines: [] };
    expect(applyGroupedPackagePrice({ modelVersion: 'LEGACY' }, legacy)).toBe(legacy);
  });

  it('rejects persisted self and indirect dependency cycles', () => {
    const first = packageFixture.groups[0];
    expect(() => decorateGroupedPackage({ ...packageFixture, groups: [{ ...first, dependsOnGroupId: first.id }] })).toThrow();
    const second = { ...first, id: 'g2', key: 'second', dependsOnGroupId: first.id,
      items: first.items.map((item) => ({ ...item, id: `second-${item.id}`, groupId: 'g2' })) };
    expect(() => decorateGroupedPackage({ ...packageFixture, groups: [{ ...first, dependsOnGroupId: second.id }, second] })).toThrow();
  });

  it.each([
    ['missing delivery constraint', { ...packageFixture, groups: [{ ...packageFixture.groups[0], items: [{ ...packageFixture.groups[0].items[0], constraints: [] }] }] }],
    ['unknown dependency', { ...packageFixture, groups: [{ ...packageFixture.groups[0], dependsOnGroupId: 'missing' }] }],
    ['null unit price', { ...packageFixture, groups: [{ ...packageFixture.groups[0], items: [{ ...packageFixture.groups[0].items[0], unitPrice: null }] }] }],
  ])('fails closed for malformed persisted V2 data: %s', (_label, malformed) => {
    expect(() => decorateGroupedPackage(malformed as never)).toThrow();
  });
});
