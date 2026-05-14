import { ValidateCouponService } from './validate-coupon.service';

const baseCoupon: {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  isActive: boolean;
  expiresAt: Date | null;
  minOrderAmt: string | null;
  serviceIds: string[];
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number | null;
} = {
  id: 'c1',
  code: 'PROMO10',
  discountType: 'PERCENTAGE',
  discountValue: '10',
  isActive: true,
  expiresAt: null,
  minOrderAmt: null,
  serviceIds: [],
  maxUses: null,
  usedCount: 0,
  maxUsesPerUser: null,
};

const buildTx = (overrides: Partial<typeof baseCoupon> = {}, perUserUses = 0) => ({
  coupon: {
    findFirst: jest.fn().mockResolvedValue({ ...baseCoupon, ...overrides }),
  },
  booking: {
    count: jest.fn().mockResolvedValue(perUserUses),
  },
});

describe('ValidateCouponService', () => {
  let svc: ValidateCouponService;
  beforeEach(() => {
    svc = new ValidateCouponService();
  });

  it('rejects unknown code', async () => {
    const tx = buildTx();
    tx.coupon.findFirst.mockResolvedValueOnce(null);
    await expect(
      svc.validate({ tx: tx as never, code: 'X', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects inactive', async () => {
    const tx = buildTx({ isActive: false });
    await expect(
      svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 }),
    ).rejects.toThrow(/inactive/i);
  });

  it('rejects expired', async () => {
    const tx = buildTx({ expiresAt: new Date('2020-01-01') });
    await expect(
      svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 }),
    ).rejects.toThrow(/expired/i);
  });

  it('rejects when subtotal below minOrderAmt', async () => {
    const tx = buildTx({ minOrderAmt: '500' });
    await expect(
      svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 }),
    ).rejects.toThrow(/minimum/i);
  });

  it('rejects when serviceIds set and serviceId not in list', async () => {
    const tx = buildTx({ serviceIds: ['svc-A', 'svc-B'] });
    await expect(
      svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 'svc-X', subtotal: 100 }),
    ).rejects.toThrow(/not eligible/i);
  });

  it('accepts when serviceIds empty (= all services)', async () => {
    const tx = buildTx({ serviceIds: [] });
    const r = await svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 'svc-X', subtotal: 100 });
    expect(r.discount).toBeGreaterThan(0);
  });

  it('rejects when maxUses reached', async () => {
    const tx = buildTx({ maxUses: 5, usedCount: 5 });
    await expect(
      svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 }),
    ).rejects.toThrow(/exhausted/i);
  });

  it('rejects when maxUsesPerUser reached', async () => {
    const tx = buildTx({ maxUsesPerUser: 2 }, 2);
    await expect(
      svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 }),
    ).rejects.toThrow(/per user/i);
  });

  it('returns correct discount for PERCENTAGE', async () => {
    const tx = buildTx({ discountType: 'PERCENTAGE', discountValue: '10' });
    const r = await svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 200 });
    expect(r.discount).toBe(20);
  });

  it('returns correct discount for FIXED, capped at subtotal', async () => {
    const tx = buildTx({ discountType: 'FIXED', discountValue: '500' });
    const r = await svc.validate({ tx: tx as never, code: 'PROMO10', orgId: 'o', clientId: 'c', serviceId: 's', subtotal: 100 });
    expect(r.discount).toBe(100);
  });
});
