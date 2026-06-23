import { ListClientBundlePurchasesHandler } from './list-client-bundle-purchases.handler';

// ---------------------------------------------------------------------------
// ListClientBundlePurchasesHandler
//
// Joins purchases + their usages with the referenced bundles (by bundleId)
// and services (by serviceId inside each usage) in bulk, so the rendered list
// has Arabic/English names without an N+1 query. Filters by status when given.
// ---------------------------------------------------------------------------

const buildPurchase = (overrides: Record<string, unknown> = {}) => ({
  id: 'bp-1',
  bundleId: 'bundle-1',
  clientId: 'client-1',
  branchId: 'branch-1',
  amountPaid: { toString: () => '15000' },
  paidAt: new Date('2026-01-15T10:00:00Z'),
  expiresAt: new Date('2027-01-15T10:00:00Z'),
  status: 'ACTIVE' as const,
  notes: null,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  usages: [],
  ...overrides,
});

const buildUsage = (overrides: Record<string, unknown> = {}) => ({
  id: 'usage-1',
  purchaseId: 'bp-1',
  bookingId: null,
  serviceId: 'svc-1',
  deliveryType: 'IN_PERSON' as const,
  quantityUsed: 1,
  usedAt: new Date('2026-02-01T10:00:00Z'),
  notes: null,
  ...overrides,
});

const buildHandler = (overrides: {
  purchases?: ReturnType<typeof buildPurchase>[];
  bundles?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
} = {}) => {
  const purchases = overrides.purchases ?? [buildPurchase()];
  const bundles = overrides.bundles ?? [
    {
      id: 'bundle-1',
      nameAr: 'باقة استشارية',
      nameEn: 'Consultation Bundle',
      discountType: 'PERCENTAGE',
      discountValue: { toString: () => '10' },
      items: [
        { service: { id: 'svc-1', nameAr: 'استشارة فردية', nameEn: 'Individual Consultation' } },
      ],
    },
  ];
  const services = overrides.services ?? [
    { id: 'svc-1', nameAr: 'استشارة فردية', nameEn: 'Individual Consultation' },
  ];

  const prisma = {
    bundlePurchase: {
      findMany: jest.fn().mockResolvedValue(purchases),
    },
    serviceBundle: {
      findMany: jest.fn().mockResolvedValue(bundles),
    },
    service: {
      findMany: jest.fn().mockResolvedValue(services),
    },
  };

  const handler = new ListClientBundlePurchasesHandler(prisma as never);
  return { handler, prisma };
};

describe('ListClientBundlePurchasesHandler', () => {
  it('returns purchases with their usages + joined bundle name and service name', async () => {
    const usage = buildUsage({ serviceId: 'svc-1' });
    const purchase = buildPurchase({ usages: [usage] });
    const { handler, prisma } = buildHandler({ purchases: [purchase] });

    const result = await handler.execute({ clientId: 'client-1' });

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.id).toBe('bp-1');
    expect(row.bundleId).toBe('bundle-1');
    expect(row.bundleName).toBe('باقة استشارية');
    expect(row.amountPaid).toBe(15000);
    expect(row.totalUsages).toBe(1);
    expect(row.usages[0]).toEqual(
      expect.objectContaining({
        id: 'usage-1',
        serviceId: 'svc-1',
        serviceName: 'استشارة فردية',
        deliveryType: 'IN_PERSON',
        quantityUsed: 1,
      }),
    );
    // purchasedAt / expiresAt must be the original Date instances.
    expect(row.paidAt).toEqual(new Date('2026-01-15T10:00:00Z'));
    expect(row.expiresAt).toEqual(new Date('2027-01-15T10:00:00Z'));
    // Order is most recent first.
    expect(prisma.bundlePurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('filters by clientId via the where clause', async () => {
    const { handler, prisma } = buildHandler();
    await handler.execute({ clientId: 'client-1' });
    expect(prisma.bundlePurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'client-1' } }),
    );
  });

  it('appends status to the where clause only when provided', async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute({ clientId: 'client-1' });
    expect(prisma.bundlePurchase.findMany.mock.calls[0][0].where).toEqual({ clientId: 'client-1' });

    await handler.execute({ clientId: 'client-1', status: 'COMPLETED' });
    expect(prisma.bundlePurchase.findMany.mock.calls[1][0].where).toEqual({
      clientId: 'client-1',
      status: 'COMPLETED',
    });
  });

  it('returns an empty array (and skips the join lookups) when the client has no purchases', async () => {
    const { handler, prisma } = buildHandler({ purchases: [] });

    const result = await handler.execute({ clientId: 'client-1' });

    expect(result).toEqual([]);
    // No bundleIds / serviceIds → no IN(...) lookups at all.
    expect(prisma.serviceBundle.findMany).not.toHaveBeenCalled();
    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('falls back to an empty bundleName and empty serviceName when the join is missing', async () => {
    // Purchase references a bundle that was deleted and a service that was
    // renamed/deleted — the handler must not throw, it must return empty
    // strings so the dashboard renders gracefully.
    const purchase = buildPurchase({
      bundleId: 'bundle-deleted',
      usages: [buildUsage({ id: 'usage-orphan', serviceId: 'svc-deleted' })],
    });
    const { handler } = buildHandler({ purchases: [purchase] });

    const result = await handler.execute({ clientId: 'client-1' });

    expect(result[0].bundleName).toBe('');
    expect(result[0].usages[0].serviceName).toBe('');
  });

  it('coerces a Decimal amountPaid to a plain integer halala number', async () => {
    const purchase = buildPurchase({
      amountPaid: { toString: () => '12345.67' }, // DB Decimal(12,2) of whole halalas
    });
    const { handler } = buildHandler({ purchases: [purchase] });

    const result = await handler.execute({ clientId: 'client-1' });
    expect(result[0].amountPaid).toBe(12345.67);
    expect(typeof result[0].amountPaid).toBe('number');
  });

  it('returns usages: [] (and totalUsages=0) for a brand-new purchase with no usages', async () => {
    const purchase = buildPurchase({ usages: [] });
    const { handler } = buildHandler({ purchases: [purchase] });

    const result = await handler.execute({ clientId: 'client-1' });
    expect(result[0].totalUsages).toBe(0);
    expect(result[0].usages).toEqual([]);
  });

  it('bulk-fetches referenced bundles via where.id IN [...] and selects the joinable fields', async () => {
    const { handler, prisma } = buildHandler({
      purchases: [
        buildPurchase({ id: 'bp-1', bundleId: 'bundle-1' }),
        buildPurchase({ id: 'bp-2', bundleId: 'bundle-2' }),
        buildPurchase({ id: 'bp-3', bundleId: 'bundle-1' }),
      ],
    });

    await handler.execute({ clientId: 'client-1' });

    expect(prisma.serviceBundle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['bundle-1', 'bundle-2'] } },
      }),
    );
    // Select must include the fields the row mapper reads.
    const select = prisma.serviceBundle.findMany.mock.calls[0][0].select;
    expect(select).toEqual(
      expect.objectContaining({
        id: true,
        nameAr: true,
        nameEn: true,
        discountType: true,
        discountValue: true,
        items: expect.objectContaining({ include: expect.any(Object) }),
      }),
    );
  });

  it('bulk-fetches referenced services via the union of usage.serviceIds', async () => {
    const { handler, prisma } = buildHandler({
      purchases: [
        buildPurchase({
          id: 'bp-1',
          usages: [buildUsage({ serviceId: 'svc-1' }), buildUsage({ serviceId: 'svc-2' })],
        }),
        buildPurchase({
          id: 'bp-2',
          usages: [buildUsage({ id: 'u-3', serviceId: 'svc-3' }), buildUsage({ id: 'u-4', serviceId: 'svc-1' })],
        }),
      ],
    });

    await handler.execute({ clientId: 'client-1' });

    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['svc-1', 'svc-2', 'svc-3'] } } }),
    );
  });

  it('handles a purchases list with NO usages (serviceIds IN [..] must still be safely empty)', async () => {
    // purchases with usages: []  →  serviceIds is empty  →  no service.findMany call.
    const { handler, prisma } = buildHandler({
      purchases: [buildPurchase({ id: 'bp-no-usages', usages: [] })],
    });

    await handler.execute({ clientId: 'client-1' });

    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });
});
