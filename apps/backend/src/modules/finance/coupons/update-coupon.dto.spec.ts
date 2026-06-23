import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCouponDto } from './update-coupon.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCouponDto, plain);
  return validate(dto);
}

describe('UpdateCouponDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto({
      descriptionAr: 'خصم الترحيب',
      descriptionEn: 'Welcome discount',
      discountValue: 15,
      discountType: 'PERCENTAGE',
      minOrderAmt: 50.0,
      maxUses: 100,
      maxUsesPerUser: 1,
      serviceIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
      expiresAt: '2026-12-31T23:59:59.000Z',
      isActive: true,
    });
    expect(errors).toHaveLength(0);
  });

  describe('string fields (IsString)', () => {
    it('rejects a non-string descriptionAr', async () => {
      const errors = await validateDto({ descriptionAr: { text: 'x' } });
      expect(errors.some((e) => e.property === 'descriptionAr')).toBe(true);
    });
    it('rejects a non-string descriptionEn', async () => {
      const errors = await validateDto({ descriptionEn: 99 });
      expect(errors.some((e) => e.property === 'descriptionEn')).toBe(true);
    });
  });

  describe('discountValue (IsNumber)', () => {
    it('coerces a string to a number and accepts it', async () => {
      const dto = plainToInstance(UpdateCouponDto, { discountValue: '15' }, { enableImplicitConversion: true });
      expect(dto.discountValue).toBe(15);
      expect(await validate(dto)).toHaveLength(0);
    });
    it('rejects a non-number', async () => {
      const errors = await validateDto({ discountValue: { v: 1 } });
      expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
    });
  });

  describe('discountType (IsIn PERCENTAGE|FIXED)', () => {
    it.each(['PERCENTAGE', 'FIXED'] as const)('accepts "%s"', async (value) => {
      const errors = await validateDto({ discountType: value });
      expect(errors).toHaveLength(0);
    });
    it('rejects an unknown value', async () => {
      const errors = await validateDto({ discountType: 'HALF' });
      expect(errors.some((e) => e.property === 'discountType')).toBe(true);
    });
  });

  describe('maxUses (IsInt)', () => {
    it('accepts an integer', async () => {
      const errors = await validateDto({ maxUses: 100 });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-integer', async () => {
      const errors = await validateDto({ maxUses: 100.5 });
      expect(errors.some((e) => e.property === 'maxUses')).toBe(true);
    });
  });

  describe('serviceIds (IsArray + IsString each)', () => {
    it('rejects an array of non-strings', async () => {
      const errors = await validateDto({ serviceIds: [1, 2, 3] });
      expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
    });
    it('accepts an array of strings', async () => {
      const errors = await validateDto({ serviceIds: ['id-1', 'id-2'] });
      expect(errors).toHaveLength(0);
    });
  });

  describe('expiresAt (IsDateString)', () => {
    it('accepts a valid ISO date', async () => {
      const errors = await validateDto({ expiresAt: '2026-12-31T23:59:59.000Z' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-date', async () => {
      const errors = await validateDto({ expiresAt: 'next-week' });
      expect(errors.some((e) => e.property === 'expiresAt')).toBe(true);
    });
  });

  describe('isActive (IsBoolean)', () => {
    it('accepts true and false', async () => {
      expect((await validateDto({ isActive: true }))).toHaveLength(0);
      expect((await validateDto({ isActive: false }))).toHaveLength(0);
    });
    it('rejects a non-boolean', async () => {
      const errors = await validateDto({ isActive: { v: true } });
      expect(errors.some((e) => e.property === 'isActive')).toBe(true);
    });
  });
});
