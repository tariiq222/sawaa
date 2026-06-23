import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddHolidayDto } from './add-holiday.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(AddHolidayDto, plain);
  return validate(dto);
}

describe('AddHolidayDto', () => {
  const valid: Record<string, unknown> = {
    branchId: 'main-branch',
    date: '2025-12-31',
    nameAr: 'اليوم الوطني',
  };

  it('accepts a valid payload (required fields only)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload (with nameEn)', async () => {
    const errors = await validateDto({
      ...valid,
      nameEn: 'National Day',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a full ISO 8601 datetime (IsDateString passes ISO 8601)', async () => {
    const errors = await validateDto({
      ...valid,
      date: '2025-12-31T00:00:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-ISO 8601 date string', async () => {
    const errors = await validateDto({ ...valid, date: '31-12-2025' });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a non-date string', async () => {
    const errors = await validateDto({ ...valid, date: 'yesterday' });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a numeric date', async () => {
    const errors = await validateDto({ ...valid, date: 20251231 });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a missing date', async () => {
    const { date, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });

  it('rejects a missing nameAr', async () => {
    const { nameAr, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ ...valid, nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const tooLong = 'أ'.repeat(201);
    const errors = await validateDto({ ...valid, nameAr: tooLong });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a branchId longer than 100 chars', async () => {
    const tooLong = 'b'.repeat(101);
    const errors = await validateDto({ ...valid, branchId: tooLong });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a missing branchId', async () => {
    const { branchId, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-string branchId', async () => {
    const errors = await validateDto({ ...valid, branchId: 42 });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('accepts a nameEn longer than 200 chars at the boundary', async () => {
    const atLimit = 'N'.repeat(200);
    const errors = await validateDto({ ...valid, nameEn: atLimit });
    expect(errors).toHaveLength(0);
  });

  it('rejects a nameEn longer than 200 chars', async () => {
    const tooLong = 'N'.repeat(201);
    const errors = await validateDto({ ...valid, nameEn: tooLong });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });
});
