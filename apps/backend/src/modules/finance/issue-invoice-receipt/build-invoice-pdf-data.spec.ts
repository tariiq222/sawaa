import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { buildInvoicePdfData } from './build-invoice-pdf-data';

// ---------------------------------------------------------------------------
// buildInvoicePdfData
//
// Pure async helper that fetches the four joined views (orgSettings, client,
// payment, booking) inside a CLS-scoped system context, then assembles the
// InvoicePdfData shape consumed by the PDF template. All money fields are
// coerced from Prisma.Decimal to integer halalas at the read boundary.
// ---------------------------------------------------------------------------

/**
 * Build a fake Prisma + CLS pair. The CLS mock mirrors nestjs-cls' API:
 *   cls.run(fn) → invokes fn and returns its result
 *   cls.set(key, value) → records the key
 * The promise.all inside buildInvoicePdfData reads from a single set of
 * Promise.all callers; each .findFirst/.findUnique resolves on its own.
 */
const buildDeps = (overrides: {
  orgSettings?: Record<string, unknown> | null;
  client?: Record<string, unknown> | null;
  payment?: Record<string, unknown> | null;
  booking?: Record<string, unknown> | null;
  paymentId?: string | null;
  invoice?: Record<string, unknown>;
} = {}) => {
  const orgSettings =
    overrides.orgSettings === null
      ? null
      : overrides.orgSettings ?? {
          companyNameAr: 'مركز سواء',
          vatRegistrationNumber: '300000000000003',
          sellerAddress: 'الرياض - حي العليا',
        };
  const client =
    overrides.client === null
      ? null
      : overrides.client ?? { firstName: 'فاطمة', lastName: 'الزيد' };
  const payment =
    overrides.payment === null
      ? null
      : overrides.payment ?? { method: 'CASH', amount: 11500, effectiveReceivedAt: null, processedAt: null, createdAt: new Date('2026-05-24T10:03:00Z') };
  const booking =
    overrides.booking === null
      ? null
      : overrides.booking ?? { serviceNameSnapshot: 'استشارة أسرية' };

  const invoice = overrides.invoice ?? {
    id: 'inv-1',
    number: 42,
    status: 'PAID',
    issuedAt: new Date('2026-05-24T10:00:00Z'),
    paidAt: new Date('2026-05-24T10:05:00Z'),
    clientId: 'client-1',
    bookingId: 'book-1',
    packagePurchaseId: null,
    subtotal: 10000,
    discountAmt: 0,
    vatAmt: 1500,
    total: 11500,
    currency: 'SAR',
    createdAt: new Date('2026-05-24T10:00:00Z'),
  };

  const prisma = {
    organizationSettings: { findFirst: jest.fn().mockResolvedValue(orgSettings) },
    client: { findUnique: jest.fn().mockResolvedValue(client) },
    payment: { findMany: jest.fn().mockResolvedValue(payment ? [payment] : []) },
    booking: { findFirst: jest.fn().mockResolvedValue(booking) },
  };

  const setKeys: Record<string, unknown> = {};
  const cls = {
    run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    set: jest.fn((key: string, value: unknown) => {
      setKeys[key] = value;
    }),
  };

  return { prisma, cls, invoice, setKeys };
};

describe('buildInvoicePdfData', () => {
  it('assembles seller / client / service / payment data from the joined views', async () => {
    const { prisma, cls, invoice } = buildDeps();
    const data = await buildInvoicePdfData(
      prisma as never,
      cls as never,
      invoice as never,
      'receipt',
    );

    expect(data).toEqual({
      kind: 'receipt',
      status: 'PAID',
      outstanding: 0,
      invoiceNumber: 42,
      invoiceId: 'inv-1',
      issuedAt: new Date('2026-05-24T10:00:00Z'),
      paidAt: new Date('2026-05-24T10:05:00Z'),
      sellerNameAr: 'مركز سواء',
      sellerVatNumber: '300000000000003',
      sellerAddress: 'الرياض - حي العليا',
      logoUrl: null,
      // brandColor is sourced from the shared brand constant — a non-empty
      // hex string is the only contract.
      brandColor: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      clientName: 'فاطمة الزيد',
      serviceName: 'استشارة أسرية',
      subtotal: 10000,
      discountAmt: 0,
      vatAmt: 1500,
      total: 11500,
      currency: 'SAR',
      paymentMethod: 'CASH',
      payments: [{ date: new Date('2026-05-24T10:03:00Z'), method: 'CASH', amount: 11500 }],
      qrDataUrl: null,
    });
  });

  it('sets the systemContext CLS key before running the joined lookups (cross-tenant safe)', async () => {
    const { prisma, cls, setKeys, invoice } = buildDeps();
    await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(cls.set).toHaveBeenCalledWith(SYSTEM_CONTEXT_CLS_KEY, true);
    expect(setKeys[SYSTEM_CONTEXT_CLS_KEY]).toBe(true);
  });

  it('queries every COMPLETED payment of the invoice', async () => {
    const { prisma, cls, invoice } = buildDeps();
    await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { invoiceId: 'inv-1', status: 'COMPLETED' } }),
    );
  });

  it('falls back to a placeholder "—" client / service / payment when the join is missing', async () => {
    const { prisma, cls, invoice } = buildDeps({
      orgSettings: null,
      client: null,
      payment: null,
      booking: null,
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.clientName).toBe('—');
    expect(data.serviceName).toBe('—');
    expect(data.paymentMethod).toBe('—');
    expect(data.payments).toEqual([]);
    // Org settings fallback uses the hard-coded Arabic brand.
    expect(data.sellerNameAr).toBe('مركز سواء');
    expect(data.sellerVatNumber).toBeNull();
    expect(data.sellerAddress).toBeNull();
  });

  it('renders the client name from firstName + lastName with a single trimmed space', async () => {
    const { prisma, cls, invoice } = buildDeps({
      client: { firstName: '  فاطمة  ', lastName: '  الزيد  ' },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.clientName).toBe('فاطمة     الزيد');
  });

  it('renders the client name with no trailing space when lastName is null/empty', async () => {
    const { prisma, cls, invoice } = buildDeps({
      client: { firstName: 'فاطمة', lastName: null },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.clientName).toBe('فاطمة');
  });

  it('substitutes "باقة جلسات" for the service name when the invoice has a packagePurchaseId and no booking', async () => {
    const { prisma, cls, invoice } = buildDeps({
      booking: null,
      invoice: {
        id: 'inv-package',
        number: 99,
        issuedAt: new Date(),
        paidAt: new Date(),
        clientId: 'client-1',
        bookingId: null,
        packagePurchaseId: 'bp-1',
        subtotal: 10000,
        discountAmt: 0,
        vatAmt: 1500,
        total: 11500,
        currency: 'SAR',
        createdAt: new Date(),
      },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.serviceName).toBe('باقة جلسات');
  });

  it('coerces Prisma.Decimal money columns to integer halalas at the read boundary', async () => {
    const { Prisma } = await import('@prisma/client');
    const { prisma, cls, invoice } = buildDeps({
      invoice: {
        id: 'inv-dec',
        number: 100,
        issuedAt: new Date(),
        paidAt: new Date(),
        clientId: 'client-1',
        bookingId: 'book-1',
        packagePurchaseId: null,
        subtotal: new Prisma.Decimal('999950'),
        discountAmt: new Prisma.Decimal('10000'),
        vatAmt: new Prisma.Decimal('148493'),
        total: new Prisma.Decimal('1138443'),
        currency: 'SAR',
        createdAt: new Date(),
      },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.subtotal).toBe(999950);
    expect(data.discountAmt).toBe(10000);
    expect(data.vatAmt).toBe(148493);
    expect(data.total).toBe(1138443);
  });

  it('falls back to invoice.createdAt when issuedAt is null', async () => {
    const { prisma, cls, invoice } = buildDeps({
      invoice: {
        id: 'inv-1',
        number: 42,
        issuedAt: null,
        paidAt: new Date('2026-05-24T10:05:00Z'),
        clientId: 'client-1',
        bookingId: 'book-1',
        packagePurchaseId: null,
        subtotal: 10000,
        discountAmt: 0,
        vatAmt: 1500,
        total: 11500,
        currency: 'SAR',
        createdAt: new Date('2026-05-24T10:00:00Z'),
      },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.issuedAt).toEqual(new Date('2026-05-24T10:00:00Z'));
  });

  it('keeps paidAt null when the invoice is not paid (never a render-time clock)', async () => {
    const { prisma, cls, invoice } = buildDeps({
      invoice: {
        id: 'inv-1',
        number: 42,
        status: 'ISSUED',
        issuedAt: new Date('2026-05-24T10:00:00Z'),
        paidAt: null,
        clientId: 'client-1',
        bookingId: 'book-1',
        packagePurchaseId: null,
        subtotal: 10000,
        discountAmt: 0,
        vatAmt: 1500,
        total: 11500,
        currency: 'SAR',
        createdAt: new Date('2026-05-24T10:00:00Z'),
      },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(data.paidAt).toBeNull();
  });

  it('only fetches the booking when the invoice has a bookingId (defensive)', async () => {
    const { prisma, cls, invoice } = buildDeps({
      booking: null,
      invoice: {
        id: 'inv-package',
        number: 99,
        issuedAt: new Date(),
        paidAt: new Date(),
        clientId: 'client-1',
        bookingId: null, // package-purchase invoice — no booking
        packagePurchaseId: 'bp-1',
        subtotal: 10000,
        discountAmt: 0,
        vatAmt: 1500,
        total: 11500,
        currency: 'SAR',
        createdAt: new Date(),
      },
    });
    await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'receipt');
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
  });

  it('computes the statement outstanding from total minus completed payments', async () => {
    const { prisma, cls, invoice } = buildDeps({
      payment: { method: 'CASH', amount: 4000, effectiveReceivedAt: null, processedAt: null, createdAt: new Date('2026-05-24T10:03:00Z') },
      invoice: {
        id: 'inv-1',
        number: 42,
        status: 'PARTIALLY_PAID',
        issuedAt: new Date('2026-05-24T10:00:00Z'),
        paidAt: null,
        clientId: 'client-1',
        bookingId: 'book-1',
        packagePurchaseId: null,
        subtotal: 10000,
        discountAmt: 0,
        vatAmt: 1500,
        total: 11500,
        currency: 'SAR',
        createdAt: new Date('2026-05-24T10:00:00Z'),
      },
    });
    const data = await buildInvoicePdfData(prisma as never, cls as never, invoice as never, 'statement');
    expect(data.kind).toBe('statement');
    expect(data.status).toBe('PARTIALLY_PAID');
    expect(data.outstanding).toBe(7500);
  });
});
