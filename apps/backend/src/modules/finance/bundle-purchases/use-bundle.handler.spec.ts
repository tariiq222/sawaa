import { Prisma, BundlePurchaseStatus, DeliveryType } from '@prisma/client';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UseBundleHandler } from './use-bundle.handler';

// ---------------------------------------------------------------------------
// P0-16 — bundle-purchase overbooking guard
//
// The previous implementation read `totalUsed` outside the transaction and
// wrote `bundleUsage` without re-checking, letting two concurrent calls each
// observe `remaining = 1` and both succeed — silent overbooking that gave the
// client extra free sessions. The fix:
//   * `SELECT ... FOR UPDATE` on the BundlePurchase row (serialises readers),
//   * recount of `bundleUsage` INSIDE the transaction,
//   * rejection when `totalUsed + quantityUsed > totalQuantity`,
//   * automatic COMPLETED transition when the bundle is fully consumed.
//
// All branch + edge cases below exercise the real `execute()` path with the
// real serializable-isolation wrapper; only Prisma is mocked.
// ---------------------------------------------------------------------------

const SERIALIZABLE = Prisma.TransactionIsolationLevel.Serializable;

const buildBundle = (overrides: Record<string, unknown> = {}) => ({
  id: 'bundle-1',
  archivedAt: null,
  items: [
    { id: 'bitem-1', serviceId: 'svc-1' },
    { id: 'bitem-2', serviceId: 'svc-2' },
  ],
  ...overrides,
});

/**
 * Build a transaction client that the handler sees inside the serializable
 * `$transaction` callback. By default the locked purchase row is ACTIVE, the
 * bundle has 2 items, and no prior usages have been recorded.
 */
const buildTx = (overrides: {
  lockedRows?: Array<{ id: string; status: string; bundleId: string }>;
  bundle?: ReturnType<typeof buildBundle> | null;
  totalUsed?: number | null;
  createResult?: Record<string, unknown>;
} = {}) => {
  const lockedRows = overrides.lockedRows ?? [
    { id: 'bp-1', status: BundlePurchaseStatus.ACTIVE, bundleId: 'bundle-1' },
  ];
  const bundle = overrides.bundle === null ? null : overrides.bundle ?? buildBundle();
  const createResult = overrides.createResult ?? {
    id: 'usage-1',
    purchaseId: 'bp-1',
    serviceId: 'svc-1',
    quantityUsed: 1,
  };
  return {
    $queryRaw: jest.fn().mockResolvedValue(lockedRows),
    serviceBundle: {
      findFirst: jest.fn().mockResolvedValue(bundle),
    },
    bundleUsage: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { quantityUsed: overrides.totalUsed ?? 0 },
      }),
      create: jest.fn().mockResolvedValue(createResult),
    },
    bundlePurchase: {
      update: jest.fn().mockResolvedValue({ id: 'bp-1', status: BundlePurchaseStatus.COMPLETED }),
    },
  };
};

/**
 * Wire a tx + prisma pair, with a RlsTransactionService that invokes the
 * callback synchronously with the supplied tx and Serializable isolation.
 */
const wireHandler = (tx: ReturnType<typeof buildTx>) => {
  const prisma = { _passthroughTx: tx } as unknown as Record<string, unknown>;
  const rlsTransaction = {
    withTransaction: jest.fn(
      (fn: (tx: unknown) => Promise<unknown>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }) => {
        // SECURITY: the handler MUST pass Serializable isolation. Fail loudly
        // if a future refactor drops the option — this is the entire reason
        // P0-16 exists.
        expect(options?.isolationLevel).toBe(SERIALIZABLE);
        return fn(tx);
      },
    ),
  };
  const handler = new UseBundleHandler(prisma as never, rlsTransaction as never);
  return { handler, prisma, rlsTransaction };
};

describe('UseBundleHandler', () => {
  it('runs the write under Serializable isolation (P0-16 core invariant)', async () => {
    const tx = buildTx();
    const { handler, rlsTransaction } = wireHandler(tx);

    await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    const call = rlsTransaction.withTransaction.mock.calls[0];
    expect(call[1]).toEqual({ isolationLevel: SERIALIZABLE });
  });

  it('locks the BundlePurchase row with SELECT ... FOR UPDATE before any read', async () => {
    const tx = buildTx();
    const { handler } = wireHandler(tx);

    await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = String(tx.$queryRaw.mock.calls[0][0]);
    // Both the literal SQL fragment and the parameter binding must be present.
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('BundlePurchase');
  });

  it('decrements remaining sessions and returns the new usage row on the happy path', async () => {
    // 2-item bundle, 1 prior usage → 1 remaining. Asking for 1 should pass.
    const tx = buildTx({ totalUsed: 1 });
    const { handler } = wireHandler(tx);

    const result = await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' });

    expect(tx.bundleUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purchaseId: 'bp-1',
        serviceId: 'svc-1',
        quantityUsed: 1,
        deliveryType: DeliveryType.IN_PERSON,
      }),
    });
    expect(result).toMatchObject({ id: 'usage-1', purchaseId: 'bp-1' });
  });

  it('uses the supplied deliveryType instead of the IN_PERSON default', async () => {
    const tx = buildTx();
    const { handler } = wireHandler(tx);

    await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1', deliveryType: DeliveryType.ONLINE });

    expect(tx.bundleUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deliveryType: DeliveryType.ONLINE }),
    });
  });

  it('respects an explicit quantityUsed > 1 and only decrements once', async () => {
    const tx = buildTx({ totalUsed: 0 });
    const { handler } = wireHandler(tx);

    await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1', quantityUsed: 2 });

    expect(tx.bundleUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantityUsed: 2 }),
    });
  });

  it('P0-16: rejects with ConflictException when the bundle is exhausted (overbooking guard)', async () => {
    // 2-item bundle already fully consumed (totalUsed=2). Even quantityUsed=1
    // would push the total over the limit — must be rejected.
    const tx = buildTx({ totalUsed: 2 });
    const { handler } = wireHandler(tx);

    await expect(handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' })).rejects.toThrow(
      ConflictException,
    );
    expect(tx.bundleUsage.create).not.toHaveBeenCalled();
    expect(tx.bundlePurchase.update).not.toHaveBeenCalled();
  });

  it('P0-16: rejects when totalUsed + quantityUsed equals totalQuantity + 1 (exact overbook)', async () => {
    // 2-item bundle, 1 used; quantityUsed=2 would land 3 > 2. Reject.
    const tx = buildTx({ totalUsed: 1 });
    const { handler } = wireHandler(tx);

    await expect(
      handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1', quantityUsed: 2 }),
    ).rejects.toThrow(ConflictException);
    expect(tx.bundleUsage.create).not.toHaveBeenCalled();
  });

  it('P0-16: accepts the final use (totalUsed + quantityUsed === totalQuantity) and flips the purchase to COMPLETED', async () => {
    // 2-item bundle, 1 already used; this call asks for 1 more. After write:
    // totalUsed=2 === totalQuantity=2 → purchase must auto-complete.
    const tx = buildTx({ totalUsed: 1 });
    const { handler } = wireHandler(tx);

    await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' });

    expect(tx.bundleUsage.create).toHaveBeenCalled();
    expect(tx.bundlePurchase.update).toHaveBeenCalledWith({
      where: { id: 'bp-1' },
      data: { status: BundlePurchaseStatus.COMPLETED },
    });
  });

  it('does NOT flip the purchase to COMPLETED when one or more sessions remain', async () => {
    // 2-item bundle, 0 used; this call asks for 1. After write: 1 < 2 → still ACTIVE.
    const tx = buildTx({ totalUsed: 0 });
    const { handler } = wireHandler(tx);

    await handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' });

    expect(tx.bundlePurchase.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the BundlePurchase row does not exist (no FOR UPDATE row)', async () => {
    const tx = buildTx({ lockedRows: [] });
    const { handler } = wireHandler(tx);

    await expect(handler.execute({ purchaseId: 'missing', serviceId: 'svc-1' })).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.bundleUsage.create).not.toHaveBeenCalled();
  });

  it('rejects a purchase whose status is not ACTIVE (e.g. EXPIRED, CANCELLED, COMPLETED)', async () => {
    const tx = buildTx({
      lockedRows: [
        { id: 'bp-1', status: BundlePurchaseStatus.EXPIRED, bundleId: 'bundle-1' },
      ],
    });
    const { handler } = wireHandler(tx);

    await expect(handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' })).rejects.toThrow(
      BadRequestException,
    );
    // Critical: must NOT proceed to read bundle or write usage.
    expect(tx.serviceBundle.findFirst).not.toHaveBeenCalled();
    expect(tx.bundleUsage.create).not.toHaveBeenCalled();
  });

  it('rejects a purchase whose underlying ServiceBundle is archived (simulates the WHERE archivedAt=null filter)', async () => {
    // The handler relies on Prisma's `where: { archivedAt: null }` filter at
    // the DB level; a real DB returns null for archived rows. The test mock
    // must mirror that contract — we explicitly pass bundle=null to make the
    // findFirst resolve to null and trigger the NotFoundException branch.
    const tx = buildTx({ bundle: null });
    const { handler } = wireHandler(tx);

    await expect(handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1' })).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.bundleUsage.create).not.toHaveBeenCalled();
  });

  it('rejects a serviceId that is not part of this bundle', async () => {
    const tx = buildTx();
    const { handler } = wireHandler(tx);

    await expect(
      handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-not-in-bundle' }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.bundleUsage.create).not.toHaveBeenCalled();
  });

  it('rejects quantityUsed < 1 BEFORE entering the transaction (no row lock taken)', async () => {
    const tx = buildTx();
    const { handler, rlsTransaction } = wireHandler(tx);

    await expect(
      handler.execute({ purchaseId: 'bp-1', serviceId: 'svc-1', quantityUsed: 0 }),
    ).rejects.toThrow(BadRequestException);
    // The guard runs pre-transaction — no DB activity, no row lock.
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });
});
