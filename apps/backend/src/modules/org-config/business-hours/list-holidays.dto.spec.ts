import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListHolidaysDto } from './list-holidays.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListHolidaysDto, plain);
  return validate(dto);
}

describe('ListHolidaysDto', () => {
  const valid: Record<string, unknown> = { branchId: 'main-branch' };

  it('accepts a valid payload (required field only)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('coerces a string branchId to itself (@Type(() => String))', async () => {
    const errors = await validateDto({ branchId: 'riyadh-branch' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a year within the valid range', async () => {
    const errors = await validateDto({ ...valid, year: 2025 });
    expect(errors).toHaveLength(0);
  });

  it('accepts the lower year boundary (2000)', async () => {
    const errors = await validateDto({ ...valid, year: 2000 });
    expect(errors).toHaveLength(0);
  });

  it('accepts the upper year boundary (3000)', async () => {
    const errors = await validateDto({ ...valid, year: 3000 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a year below 2000', async () => {
    const errors = await validateDto({ ...valid, year: 1999 });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('rejects a year above 3000', async () => {
    const errors = await validateDto({ ...valid, year: 3001 });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('rejects a non-integer year', async () => {
    const errors = await validateDto({ ...valid, year: 2025.5 });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('rejects a non-numeric year', async () => {
    const errors = await validateDto({ ...valid, year: 'twenty-twenty-five' });
    expect(errors.some((e) => e.property === 'year')).toBe(true);
  });

  it('accepts a year omitted (optional)', async () => {
    const errors = await validateDto(valid);
    expect(errors.some((e) => e.property === 'year')).toBe(false);
  });

  it('rejects a missing branchId', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a branchId longer than 100 chars', async () => {
    const tooLong = 'b'.repeat(101);
    const errors = await validateDto({ ...valid, branchId: tooLong });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });
});
