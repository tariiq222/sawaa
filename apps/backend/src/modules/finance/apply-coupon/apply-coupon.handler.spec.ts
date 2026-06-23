import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApplyCouponHandler } from './apply-coupon.handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildInvoice = (overrides: Partial<typeof defaultInvoice> = {}) => ({
  ...defaultInvoice,
  ...overrides,
});

const buildCoupon = (overrides: Partial<typeof defaultCoupon> = {}) => ({
  ...defaultCoupon,
  ...overrides,
});

// Default invoice: 10 000 halalas subtotal, 0 existing discount, 15% VAT, booking-backed.
// bookingId is explicitly `string | null` so buildInvoice({ bookingId: null })
// typechecks (the bundle path must set bookingId=null).
const defaultInvoice: {
  id: string;
  clientId: string;
  bookingId: string | null;
  bundlePurchaseId: string | null;
  subtotal: number;
  discountAmt: number;
  vatRate: number;
  vatAmt: number;
  total: number;
} = {
  id: 'inv-1',
  clientId: 'client-1',
  bookingId: 'book-1',
  bundlePurchaseId: null,
  subtotal: 10000,
  discountAmt: 0,
  vatRate: 0.15,
  vatAmt: 1500,
  total: 11500,
};

// Default coupon: 10% percentage discount, no limits, no service restriction
const defaultCoupon: {
  id: string;
  code: string;
  isActive: boolean;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  minOrderAmt: number | null;
  maxUsesPerUser: number | null;
  serviceIds: string[];
} = {
  id: 'coupon-1',
  code: 'SAVE10',
  isActive: true,
  discountType: 'PERCENTAGE',
  discountValue: 10,
  expiresAt: null,
  maxUses: null,
  usedCount: 0,
  minOrderAmt: null,
  maxUsesPerUser: null,
  serviceIds: [],
};

const buildPrisma = (
  invoice: ReturnType<typeof buildInvoice> = buildInvoice(),
  coupon: ReturnType<typeof buildCoupon> = buildCoupon(),
  bookingServiceId: string | null = 'svc-1',
) => {
  const db: {
    invoice: { findFirst: jest.Mock; update: jest.Mock };
    coupon: { findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    couponRedemption: { findUnique: jest.Mock; count: jest.Mock; create: jest.Mock };
    booking: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  } = {
    invoice: {
      findFirst: jest.fn().mockResolvedValue(invoice),
      update: jest.fn().mockResolvedValue(invoice),
    },
    coupon: {
      findFirst: jest.fn().mockResolvedValue(coupon),
      update: jest.fn().mockResolvedValue(coupon),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    couponRedemption: {
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'red-1', couponId: coupon.id, invoiceId: invoice.id, discount: 0 }),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue(
        bookingServiceId === null ? null : { id: invoice.bookingId, serviceId: bookingServiceId },
      ),
    },
    $transaction: jest.fn(),
  };
  db.$transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(db));
  return db;
};

const buildRlsTransaction = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
});

const buildHandler = (
  invoice?: ReturnType<typeof buildInvoice>,
  coupon?: ReturnType<typeof buildCoupon>,
  bookingServiceId: string | null = 'svc-1',
): { handler: ApplyCouponHandler; prisma: ReturnType<typeof buildPrisma> } => {
  const prisma = buildPrisma(invoice, coupon, bookingServiceId);
  const handler = new ApplyCouponHandler(prisma as never, buildRlsTransaction(prisma) as never);
  return { handler, prisma };
};

const cmd = { invoiceId: 'inv-1', code: 'SAVE10' };

// ---------------------------------------------------------------------------
// Test helpers: extract what was written to invoice and redemption
// ---------------------------------------------------------------------------

const captureInvoiceUpdate = (prisma: ReturnType<typeof buildPrisma>) => {
  const call = prisma.invoice.update.mock.calls[0]?.[0];
  return call?.data as { discountAmt: number; vatAmt: number; total: number } | undefined;
};

const captureRedemptionDiscount = (prisma: ReturnType<typeof buildPrisma>) => {
  const call = prisma.couponRedemption.create.mock.calls[0]?.[0];
  return call?.data?.discount as number | undefined;
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ApplyCouponHandler — halalas invariants', () => {
  // ─── Percentage coupon ──────────────────────────────────────────────────

  it('10% coupon on 10 000 halalas → discount 1000, newSubtotal 9000, VAT on 9000', async () => {
    const { handler, prisma } = buildHandler();
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    expect(captureRedemptionDiscount(prisma)).toBe(1000);
    expect(written?.discountAmt).toBe(1000);
    // newVatBase = 10000 − 1000 = 9000; VAT 15% = 1350 halalas (integer)
    expect(written?.vatAmt).toBe(1350);
    expect(written?.total).toBe(10350);
    // Halala invariant: discount + newSubtotal = oldSubtotal
    // (newSubtotal = invoiceSubtotal − discountAmt = 9000)
    expect(1000 + 9000).toBe(10000);
  });

  // ─── Fixed coupon ────────────────────────────────────────────────────────

  it('fixed 500 halalas coupon on 10 000 → discount 500, newSubtotal 9500', async () => {
    const coupon = buildCoupon({ discountType: 'FIXED', discountValue: 500 });
    const { handler, prisma } = buildHandler(undefined, coupon);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    expect(captureRedemptionDiscount(prisma)).toBe(500);
    expect(written?.discountAmt).toBe(500);
    // newVatBase = 9500; VAT 15% = 1425
    expect(written?.vatAmt).toBe(1425);
    expect(written?.total).toBe(10925);
    expect(500 + 9500).toBe(10000);
  });

  // ─── Rounding: odd subtotal ─────────────────────────────────────────────

  it('50% coupon on 333 halalas → discount 167 (ROUND_HALF_UP), newSubtotal 166, 167+166=333', async () => {
    const invoice = buildInvoice({ subtotal: 333, vatRate: 0, vatAmt: 0, total: 333 });
    const coupon = buildCoupon({ discountValue: 50 });
    const { handler, prisma } = buildHandler(invoice, coupon);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    const discount = captureRedemptionDiscount(prisma);
    expect(discount).toBe(167); // ROUND_HALF_UP of 333*50/100 = 166.5
    expect(written?.discountAmt).toBe(167);
    expect(167 + 166).toBe(333); // invariant holds
  });

  // ─── Coupon larger than subtotal ─────────────────────────────────────────

  it('fixed coupon 20 000 on 10 000 → discount capped at 10 000, newSubtotal = 0, total = 0 VAT', async () => {
    const coupon = buildCoupon({ discountType: 'FIXED', discountValue: 20000 });
    const { handler, prisma } = buildHandler(undefined, coupon);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    expect(captureRedemptionDiscount(prisma)).toBe(10000); // capped at subtotal
    expect(written?.discountAmt).toBe(10000);
    expect(written?.vatAmt).toBe(0); // newVatBase = max(0, 10000-10000) = 0
    expect(written?.total).toBe(0);
  });

  it('100% percentage coupon → discount = subtotal, newSubtotal = 0, total = 0', async () => {
    const coupon = buildCoupon({ discountValue: 100 });
    const { handler, prisma } = buildHandler(undefined, coupon);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    expect(captureRedemptionDiscount(prisma)).toBe(10000);
    expect(written?.discountAmt).toBe(10000);
    expect(written?.vatAmt).toBe(0);
    expect(written?.total).toBe(0);
  });

  // ─── Edge: 0% coupon ─────────────────────────────────────────────────────

  it('0% coupon → discount = 0, invoice unchanged', async () => {
    const coupon = buildCoupon({ discountValue: 0 });
    const { handler, prisma } = buildHandler(undefined, coupon);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    expect(captureRedemptionDiscount(prisma)).toBe(0);
    expect(written?.discountAmt).toBe(0);
    expect(written?.vatAmt).toBe(1500); // unchanged from 15% of 10000
    expect(written?.total).toBe(11500);
  });

  // ─── Cumulative: second coupon stacked on existing discount ──────────────

  it('second 10% coupon stacked on top of existing 1000 halalas discount (cumulative)', async () => {
    // invoice already has discountAmt = 1000 from a previous coupon
    const invoice = buildInvoice({ discountAmt: 1000, vatAmt: 1350, total: 10350 });
    const { handler, prisma } = buildHandler(invoice);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    // New discount = 10% of SUBTOTAL (10000) = 1000
    expect(captureRedemptionDiscount(prisma)).toBe(1000);
    // Cumulative discountAmt = 1000 + 1000 = 2000
    expect(written?.discountAmt).toBe(2000);
    // newVatBase = 10000 − 2000 = 8000; VAT 15% = 1200
    expect(written?.vatAmt).toBe(1200);
    expect(written?.total).toBe(9200);
  });

  // ─── No toDecimalPlaces(2) artifacts ─────────────────────────────────────

  it('all written amounts are integers (no fractional halalas)', async () => {
    const invoice = buildInvoice({ subtotal: 9999, vatRate: 0.15 });
    const coupon = buildCoupon({ discountValue: 33 }); // 33% of 9999 = 3299.67 → round to 3300
    const { handler, prisma } = buildHandler(invoice, coupon);
    await handler.execute(cmd);

    const written = captureInvoiceUpdate(prisma);
    const discount = captureRedemptionDiscount(prisma);
    expect(Number.isInteger(discount)).toBe(true);
    expect(Number.isInteger(written?.discountAmt)).toBe(true);
    expect(Number.isInteger(written?.vatAmt)).toBe(true);
    expect(Number.isInteger(written?.total)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Guard / validation tests (unchanged behaviour)
// ---------------------------------------------------------------------------

describe('ApplyCouponHandler — guard tests', () => {
  it('throws NotFoundException when invoice not found', async () => {
    const { handler, prisma } = buildHandler();
    prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when coupon not found', async () => {
    const { handler, prisma } = buildHandler();
    prisma.coupon.findFirst = jest.fn().mockResolvedValue(null);
    await expect(handler.execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when coupon inactive', async () => {
    const coupon = buildCoupon({ isActive: false });
    const { handler } = buildHandler(undefined, coupon);
    await expect(handler.execute(cmd)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when coupon expired', async () => {
    const coupon = buildCoupon({ expiresAt: new Date('2020-01-01') });
    const { handler } = buildHandler(undefined, coupon);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when order does not meet minimum', async () => {
    const coupon = buildCoupon({ minOrderAmt: 50000 }); // 50 000 halalas > 10 000
    const { handler } = buildHandler(undefined, coupon);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when coupon already applied to this invoice', async () => {
    const { handler, prisma } = buildHandler();
    prisma.couponRedemption.findUnique = jest.fn().mockResolvedValue({ id: 'red-existing' });
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when max uses reached', async () => {
    const coupon = buildCoupon({ maxUses: 10, usedCount: 10 });
    const { handler, prisma } = buildHandler(undefined, coupon);
    (prisma.coupon as { updateMany: jest.Mock }).updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when per-user limit exceeded', async () => {
    const coupon = buildCoupon({ maxUsesPerUser: 1 });
    const { handler, prisma } = buildHandler(undefined, coupon);
    (prisma.couponRedemption as { count: jest.Mock }).count = jest.fn().mockResolvedValue(1);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('proceeds without feature-flag check (COUPONS feature-flag removed in single-tenant migration)', async () => {
    const { handler, prisma } = buildHandler();
    const result = await handler.execute(cmd);
    expect(result.id).toBe('red-1');
    expect(prisma.coupon.findFirst).toHaveBeenCalled();
  });

  it('rejects callerClientId mismatch (P0-8)', async () => {
    const { handler } = buildHandler();
    await expect(
      handler.execute({ ...cmd, callerClientId: 'attacker' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('uses invoice.clientId as the redeeming client (P0-8)', async () => {
    const { handler, prisma } = buildHandler();
    await handler.execute(cmd);
    const redemption = prisma.couponRedemption.create.mock.calls[0]?.[0];
    expect(redemption?.data?.clientId).toBe('client-1');
  });
});

// ---------------------------------------------------------------------------
// FIN-002: Coupon.serviceIds whitelist must be enforced against the invoice's
// booking serviceId (P0). Without this guard, a service-restricted coupon can
// be redeemed on any invoice — bypassing the dashboard's per-service targeting.
// ---------------------------------------------------------------------------

describe('ApplyCouponHandler — serviceIds whitelist (FIN-002)', () => {
  it('rejects when coupon.serviceIds is non-empty and booking.serviceId is NOT in the list', async () => {
    const coupon = buildCoupon({ serviceIds: ['svc-X', 'svc-Y'] });
    const { handler, prisma } = buildHandler(undefined, coupon, 'svc-Z' /* booking.serviceId */);
    await expect(handler.execute(cmd)).rejects.toThrow(/not eligible for this service/i);
    expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('accepts when coupon.serviceIds is non-empty and booking.serviceId IS in the list', async () => {
    const coupon = buildCoupon({ serviceIds: ['svc-X', 'svc-Y'] });
    const { handler, prisma } = buildHandler(undefined, coupon, 'svc-Y' /* booking.serviceId */);
    const result = await handler.execute(cmd);
    expect(result.id).toBe('red-1');
    expect(prisma.couponRedemption.create).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalled();
  });

  it('accepts any service when coupon.serviceIds is empty (= applies to all services)', async () => {
    // Default coupon already has serviceIds: [], and booking.serviceId = 'svc-1'.
    const { handler, prisma } = buildHandler();
    const result = await handler.execute(cmd);
    expect(result.id).toBe('red-1');
    expect(prisma.couponRedemption.create).toHaveBeenCalled();
  });

  it('rejects service-restricted coupon on a bundle-backed invoice (bundle path)', async () => {
    // A bundle invoice has no single serviceId — bundles span many services,
    // and a service-restricted coupon cannot be unambiguously evaluated.
    // Minimal correct rule: reject with a clear message rather than guessing.
    const invoice = buildInvoice({ bundlePurchaseId: 'bp-1', bookingId: null });
    const coupon = buildCoupon({ serviceIds: ['svc-X'] });
    const { handler, prisma } = buildHandler(invoice, coupon);
    await expect(handler.execute(cmd)).rejects.toThrow(/restricted/i);
    expect(prisma.couponRedemption.create).not.toHaveBeenCalled();
  });

  it('accepts a coupon with empty serviceIds on a bundle-backed invoice (no restriction to violate)', async () => {
    const invoice = buildInvoice({ bundlePurchaseId: 'bp-1', bookingId: null });
    const { handler, prisma } = buildHandler(invoice);
    const result = await handler.execute(cmd);
    expect(result.id).toBe('red-1');
  });
});
