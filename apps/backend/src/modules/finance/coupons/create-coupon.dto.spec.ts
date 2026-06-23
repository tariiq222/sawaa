import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCouponDto } from './create-coupon.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateCouponDto, plain);
  return validate(dto);
}

describe('CreateCouponDto', () => {
  const valid: Record<string, unknown> = {
    code: 'WELCOME10',
    discountType: 'PERCENTAGE',
    discountValue: 10,
  };

  it('accepts a valid minimal payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully-populated valid payload', async () => {
    const errors = await validateDto({
      code: 'WELCOME10',
      descriptionAr: 'خصم الترحيب',
      descriptionEn: 'Welcome discount',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmt: 50,
      maxUses: 100,
      maxUsesPerUser: 1,
      serviceIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
      expiresAt: '2026-12-31T23:59:59.000Z',
      isActive: true,
    });
    expect(errors).toHaveLength(0);
  });

  describe('code (IsString + MaxLength(64))', () => {
    it('rejects a missing code', async () => {
      const errors = await validateDto({ discountType: valid.discountType, discountValue: valid.discountValue });
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });
    it('rejects a code longer than 64 chars', async () => {
      const errors = await validateDto({ ...valid, code: 'X'.repeat(65) });
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });
    it('rejects a non-string', async () => {
      const errors = await validateDto({ ...valid, code: { c: 'X' } });
      expect(errors.some((e) => e.property === 'code')).toBe(true);
    });
  });

  describe('descriptionAr / descriptionEn (IsString + MaxLength(500))', () => {
    it('rejects a descriptionAr longer than 500 chars', async () => {
      const errors = await validateDto({ ...valid, descriptionAr: 'ع'.repeat(501) });
      expect(errors.some((e) => e.property === 'descriptionAr')).toBe(true);
    });
    it('rejects a non-string descriptionEn', async () => {
      const errors = await validateDto({ ...valid, descriptionEn: 42 });
      expect(errors.some((e) => e.property === 'descriptionEn')).toBe(true);
    });
  });

  describe('discountType (IsIn PERCENTAGE|FIXED)', () => {
    it('accepts every allowed value', async () => {
      expect((await validateDto({ ...valid, discountType: 'PERCENTAGE' }))).toHaveLength(0);
      expect((await validateDto({ ...valid, discountType: 'FIXED' }))).toHaveLength(0);
    });
    it('rejects an unknown value', async () => {
      const errors = await validateDto({ ...valid, discountType: 'HALF' });
      expect(errors.some((e) => e.property === 'discountType')).toBe(true);
    });
    it('rejects a missing discountType', async () => {
      const errors = await validateDto({ code: valid.code, discountValue: valid.discountValue });
      expect(errors.some((e) => e.property === 'discountType')).toBe(true);
    });
  });

  describe('discountValue (IsNumber + Min(0) + Max(100_000_000))', () => {
    it('coerces a string and accepts it', async () => {
      const dto = plainToInstance(CreateCouponDto, { ...valid, discountValue: '15' }, { enableImplicitConversion: true });
      expect(dto.discountValue).toBe(15);
      expect(await validate(dto)).toHaveLength(0);
    });
    it('accepts 0 (lower bound — no negative surcharge)', async () => {
      const errors = await validateDto({ ...valid, discountValue: 0 });
      expect(errors).toHaveLength(0);
    });
    it('accepts the upper bound 100_000_000', async () => {
      const errors = await validateDto({ ...valid, discountValue: 100_000_000 });
      expect(errors).toHaveLength(0);
    });
    it('rejects a negative value (surcharge guard)', async () => {
      const errors = await validateDto({ ...valid, discountValue: -1 });
      expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
    });
    it('rejects the upper bound + 1', async () => {
      const errors = await validateDto({ ...valid, discountValue: 100_000_001 });
      expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
    });
    it('rejects a missing discountValue', async () => {
      const errors = await validateDto({ code: valid.code, discountType: valid.discountType });
      expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
    });
  });

  describe('minOrderAmt (IsNumber + Min(0))', () => {
    it('accepts a positive number', async () => {
      const errors = await validateDto({ ...valid, minOrderAmt: 50 });
      expect(errors).toHaveLength(0);
    });
    it('rejects a negative', async () => {
      const errors = await validateDto({ ...valid, minOrderAmt: -0.01 });
      expect(errors.some((e) => e.property === 'minOrderAmt')).toBe(true);
    });
  });

  describe('maxUses / maxUsesPerUser (IsInt + Min(1))', () => {
    it('accepts 1 (lower bound)', async () => {
      expect((await validateDto({ ...valid, maxUses: 1 }))).toHaveLength(0);
      expect((await validateDto({ ...valid, maxUsesPerUser: 1 }))).toHaveLength(0);
    });
    it('rejects 0', async () => {
      expect((await validateDto({ ...valid, maxUses: 0 }))).toBeTruthy();
      expect((await validateDto({ ...valid, maxUsesPerUser: 0 }))).toBeTruthy();
    });
    it('rejects a non-integer', async () => {
      const errors = await validateDto({ ...valid, maxUses: 1.5 });
      expect(errors.some((e) => e.property === 'maxUses')).toBe(true);
    });
  });

  describe('serviceIds (IsArray + ArrayMaxSize(100) + IsUUID each)', () => {
    it('accepts an array of valid v4 UUIDs', async () => {
      const errors = await validateDto({
        ...valid,
        serviceIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
      });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-UUID inside the array', async () => {
      const errors = await validateDto({ ...valid, serviceIds: ['not-a-uuid'] });
      expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
    });
    it('rejects an array larger than 100', async () => {
      const arr = Array.from({ length: 101 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i % 10}`);
      const errors = await validateDto({ ...valid, serviceIds: arr });
      expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
    });
    it('accepts an array of exactly 100', async () => {
      const arr = Array.from({ length: 100 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${i % 10}`);
      const errors = await validateDto({ ...valid, serviceIds: arr });
      expect(errors).toHaveLength(0);
    });
  });

  describe('expiresAt (IsDateString)', () => {
    it('accepts a valid ISO date', async () => {
      const errors = await validateDto({ ...valid, expiresAt: '2026-12-31T23:59:59.000Z' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-date', async () => {
      const errors = await validateDto({ ...valid, expiresAt: 'never' });
      expect(errors.some((e) => e.property === 'expiresAt')).toBe(true);
    });
  });
});
