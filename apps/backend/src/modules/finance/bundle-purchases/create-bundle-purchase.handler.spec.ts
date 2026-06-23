import { Prisma } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateBundlePurchaseHandler } from './create-bundle-purchase.handler';
import { BundlePriceService } from '../../org-experience/bundles/bundle-price.service';

// ---------------------------------------------------------------------------
// CreateBundlePurchaseHandler — money-critical path
//
// Money math is in integer HALALAS. Tests below assert EXACT halala amounts,
// never float comparisons — the bundle's stored `price` and `discountValue`
// are Decimal(12,2) of whole halalas, and the invoice is written in
// subtotal/discountAmt/vatAmt/total in halalas. See money.helper.ts and
// packages/shared/money for the canonical halala invariants.
// ---------------------------------------------------------------------------

const buildBundle = (overrides: Record<string, unknown> = {}) => ({
  id: 'bundle-1',
  archivedAt: null,
  isActive: true,
  discountType: 'PERCENTAGE' as const,
  discountValue: new Prisma.Decimal('10'),
  currency: 'SAR',
  items: [
    {
      id: 'bitem-1',
      serviceId: 'svc-1',
      service: { id: 'svc-1', price: new Prisma.Decimal('10000') },
    },
    {
      id: 'bitem-2',
      serviceId: 'svc-2',
      service: { id: 'svc-2', price: new Prisma.Decimal('5000') },
    },
  ],
  ...overrides,
});

const buildPrisma = (overrides: {
  bundle?: ReturnType<typeof buildBundle> | null;
  client?: { id: string } | null;
  existingPurchase?: { id: string } | null;
  vatRate?: string | number;
  createdPurchase?: Record<string, unknown>;
  createdInvoice?: Record<string, unknown>;
} = {}) => {
  const bundle = overrides.bundle === null ? null : overrides.bundle ?? buildBundle();
  const client = overrides.client === undefined ? { id: 'client-1' } : overrides.client;
  const existingPurchase = overrides.existingPurchase ?? null;
  const createdPurchase =
    overrides.createdPurchase ?? { id: 'bp-new', bundleId: 'bundle-1', clientId: 'client-1' };
  const createdInvoice =
    overrides.createdInvoice ?? { id: 'inv-new', bundlePurchaseId: 'bp-new', total: new Prisma.Decimal('13500') };

  const tx = {
    bundlePurchase: {
      findFirst: jest.fn().mockResolvedValue(existingPurchase),
      create: jest.fn().mockResolvedValue(createdPurchase),
    },
    organizationSettings: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ vatRate: new Prisma.Decimal(overrides.vatRate ?? '0.15') }),
    },
    invoice: {
      create: jest.fn().mockResolvedValue(createdInvoice),
    },
  };

  return {
    prisma: {
      serviceBundle: { findFirst: jest.fn().mockResolvedValue(bundle) },
      client: { findFirst: jest.fn().mockResolvedValue(client) },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    },
    tx,
  };
};

const buildHandler = (mocks: ReturnType<typeof buildPrisma>) => {
  const rlsTransaction = {
    withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mocks.tx)),
  };
  const bundlePriceService = new BundlePriceService();
  const handler = new CreateBundlePurchaseHandler(
    mocks.prisma as never,
    rlsTransaction as never,
    bundlePriceService,
  );
  return { handler, rlsTransaction, bundlePriceService, ...mocks };
};

const baseCmd = {
  bundleId: 'bundle-1',
  clientId: 'client-1',
  branchId: 'branch-1',
  employeeId: 'emp-1',
  paymentMethod: 'CASH' as const,
};

describe('CreateBundlePurchaseHandler', () => {
  it('creates the purchase and the invoice in one transaction with the right halala math (10% off 15000 = 13500)', async () => {
    const { handler, tx } = buildHandler(buildPrisma());

    const result = await handler.execute(baseCmd);

    // Bundle items are 10000 + 5000 = 15000 halalas. 10% off → finalPrice = 13500.
    expect(tx.bundlePurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bundleId: 'bundle-1',
        clientId: 'client-1',
        branchId: 'branch-1',
        // amountPaid is the finalPrice in halalas.
        amountPaid: 13500,
        status: 'ACTIVE',
      }),
    });

    // VAT 15% on 13500 = 2025 halalas; total = 13500 + 2025 = 15525.
    const invoiceCreate = tx.invoice.create.mock.calls[0][0];
    expect(invoiceCreate.data).toEqual(
      expect.objectContaining({
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'emp-1',
        bundlePurchaseId: 'bp-new',
        // subtotal stored as 0dp Decimal of integer halalas
        subtotal: expect.any(Prisma.Decimal),
        discountAmt: expect.any(Prisma.Decimal),
        vatRate: expect.any(Prisma.Decimal),
        vatAmt: expect.any(Prisma.Decimal),
        total: expect.any(Prisma.Decimal),
        currency: 'SAR',
        status: 'ISSUED',
      }),
    );
    // Exact halala assertions — money math.
    expect(invoiceCreate.data.subtotal.toString()).toBe('15000');
    expect(invoiceCreate.data.discountAmt.toString()).toBe('1500');
    expect(invoiceCreate.data.vatRate.toString()).toBe('0.15');
    expect(invoiceCreate.data.vatAmt.toString()).toBe('2025');
    expect(invoiceCreate.data.total.toString()).toBe('15525');
    // bundlePurchaseId points at the just-created purchase.
    expect(invoiceCreate.data.bundlePurchaseId).toBe('bp-new');
    expect(result.purchase.id).toBe('bp-new');
    expect(result.invoice.id).toBe('inv-new');
  });

  it('stamps paidAt and issuedAt as Date instances on create', async () => {
    const { handler, tx } = buildHandler(buildPrisma());
    const before = Date.now();
    await handler.execute(baseCmd);
    const after = Date.now();

    const purchaseData = tx.bundlePurchase.create.mock.calls[0][0].data;
    const invoiceData = tx.invoice.create.mock.calls[0][0].data;
    expect(purchaseData.paidAt).toBeInstanceOf(Date);
    expect(invoiceData.issuedAt).toBeInstanceOf(Date);
    const paidAtMs = purchaseData.paidAt.getTime();
    expect(paidAtMs).toBeGreaterThanOrEqual(before);
    expect(paidAtMs).toBeLessThanOrEqual(after);
  });

  it('persists a FIXED discount using the bundlePriceService clamp (5000 off 15000 → 10000)', async () => {
    const { handler, tx } = buildHandler(
      buildPrisma({
        bundle: buildBundle({ discountType: 'FIXED', discountValue: new Prisma.Decimal('5000') }),
      }),
    );

    await handler.execute(baseCmd);

    expect(tx.bundlePurchase.create.mock.calls[0][0].data.amountPaid).toBe(10000);
    // subtotal 15000, discount 5000, newSubtotal 10000, VAT 15% = 1500, total 11500.
    const invoiceData = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.subtotal.toString()).toBe('15000');
    expect(invoiceData.discountAmt.toString()).toBe('5000');
    expect(invoiceData.vatAmt.toString()).toBe('1500');
    expect(invoiceData.total.toString()).toBe('11500');
  });

  it('clamps a FIXED discount larger than the subtotal → finalPrice 0, VAT 0, total 0', async () => {
    const { handler, tx } = buildHandler(
      buildPrisma({
        bundle: buildBundle({ discountType: 'FIXED', discountValue: new Prisma.Decimal('99999') }),
      }),
    );

    await handler.execute(baseCmd);

    expect(tx.bundlePurchase.create.mock.calls[0][0].data.amountPaid).toBe(0);
    const invoiceData = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.subtotal.toString()).toBe('15000');
    expect(invoiceData.discountAmt.toString()).toBe('15000');
    expect(invoiceData.vatAmt.toString()).toBe('0');
    expect(invoiceData.total.toString()).toBe('0');
  });

  it('handles a 0% VAT rate from organization settings (vat 0, total = finalPrice)', async () => {
    const { handler, tx } = buildHandler(buildPrisma({ vatRate: '0' }));
    await handler.execute(baseCmd);

    const invoiceData = tx.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.vatRate.toString()).toBe('0');
    expect(invoiceData.vatAmt.toString()).toBe('0');
    // 15000 − 1500 = 13500, + 0 VAT = 13500.
    expect(invoiceData.total.toString()).toBe('13500');
  });

  it('uses the bundle currency on the invoice (e.g. SAR → KWD must round-trip)', async () => {
    const { handler, tx } = buildHandler(
      buildPrisma({ bundle: buildBundle({ currency: 'KWD' }) }),
    );
    await handler.execute(baseCmd);
    expect(tx.invoice.create.mock.calls[0][0].data.currency).toBe('KWD');
  });

  it('persists the chosen paymentMethod-free metadata + notes on the purchase row', async () => {
    const { handler, tx } = buildHandler(buildPrisma());
    await handler.execute({ ...baseCmd, notes: 'walk-in promotion' });
    expect(tx.bundlePurchase.create.mock.calls[0][0].data.notes).toBe('walk-in promotion');
  });

  it('throws NotFoundException when the bundle does not exist (or is archived/inactive)', async () => {
    const { handler } = buildHandler(buildPrisma({ bundle: null }));

    await expect(handler.execute(baseCmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the bundle exists but isInactive=false (filter removes it)', async () => {
    // isActive is part of the `where` filter, so an inactive bundle is
    // indistinguishable from a missing one — same NotFoundException, no leak.
    const { handler, prisma } = buildHandler(buildPrisma());
    prisma.serviceBundle.findFirst.mockResolvedValue(null);

    await expect(handler.execute(baseCmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the client does not exist', async () => {
    const { handler } = buildHandler(buildPrisma({ client: null }));

    await expect(handler.execute(baseCmd)).rejects.toThrow(NotFoundException);
  });

  it('rejects creating a second ACTIVE purchase of the same bundle for the same client', async () => {
    const { handler, tx } = buildHandler(
      buildPrisma({ existingPurchase: { id: 'bp-existing' } }),
    );

    await expect(handler.execute(baseCmd)).rejects.toThrow(BadRequestException);
    // No purchase or invoice should be created on the duplicate path.
    expect(tx.bundlePurchase.create).not.toHaveBeenCalled();
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it('looks up the bundle + client outside the transaction (no FOR UPDATE on those)', async () => {
    // The bundle + client are looked up read-only first; only the purchase +
    // invoice create are inside the transaction. Mock asserts the order.
    const { handler, prisma, tx } = buildHandler(buildPrisma());
    const order: string[] = [];
    prisma.serviceBundle.findFirst.mockImplementation(async () => {
      order.push('bundle');
      return buildBundle();
    });
    prisma.client.findFirst.mockImplementation(async () => {
      order.push('client');
      return { id: 'client-1' };
    });
    tx.bundlePurchase.findFirst.mockImplementation(async () => {
      order.push('tx.findFirst');
      return null;
    });
    tx.bundlePurchase.create.mockImplementation(async () => {
      order.push('tx.create');
      return { id: 'bp-new' };
    });
    tx.invoice.create.mockImplementation(async () => {
      order.push('tx.invoice');
      return { id: 'inv-new' };
    });

    await handler.execute(baseCmd);

    expect(order.slice(0, 2)).toEqual(['bundle', 'client']);
    expect(order).toContain('tx.findFirst');
    expect(order).toContain('tx.create');
    expect(order).toContain('tx.invoice');
  });
});
