import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCouponsDto } from './list-coupons.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListCouponsDto, plain);
  return validate(dto);
}

describe('ListCouponsDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  describe('search (IsString)', () => {
    it('accepts a string', async () => {
      const errors = await validateDto({ search: 'WELCOME' });
      expect(errors).toHaveLength(0);
    });
    it('rejects a non-string', async () => {
      const errors = await validateDto({ search: { q: 'x' } });
      expect(errors.some((e) => e.property === 'search')).toBe(true);
    });
  });

  describe('status (IsIn active|inactive|expired)', () => {
    it.each(['active', 'inactive', 'expired'] as const)('accepts "%s"', async (value) => {
      const errors = await validateDto({ status: value });
      expect(errors).toHaveLength(0);
    });
    it('rejects an unknown status', async () => {
      const errors = await validateDto({ status: 'archived' });
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });
  });

  describe('page (IsInt + Min(1))', () => {
    it('coerces a string "1" to a number and accepts it', async () => {
      const dto = plainToInstance(ListCouponsDto, { page: '1' }, { enableImplicitConversion: true });
      expect(dto.page).toBe(1);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
    it('accepts page = 1', async () => {
      const errors = await validateDto({ page: 1 });
      expect(errors).toHaveLength(0);
    });
    it('rejects page = 0 (Min(1))', async () => {
      const errors = await validateDto({ page: 0 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
    it('rejects a non-integer page', async () => {
      const errors = await validateDto({ page: 1.5 });
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });
  });

  describe('limit (IsInt + Min(1) + Max(100))', () => {
    it('accepts 1 (lower bound)', async () => {
      const errors = await validateDto({ limit: 1 });
      expect(errors).toHaveLength(0);
    });
    it('accepts 100 (upper bound)', async () => {
      const errors = await validateDto({ limit: 100 });
      expect(errors).toHaveLength(0);
    });
    it('rejects 0', async () => {
      const errors = await validateDto({ limit: 0 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
    it('rejects 101', async () => {
      const errors = await validateDto({ limit: 101 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
    it('rejects a non-integer', async () => {
      const errors = await validateDto({ limit: 20.5 });
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
