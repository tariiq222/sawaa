import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationDto } from './pagination.dto';

async function validateDto(plain: Record<string, unknown>) {
  return validate(plainToInstance(PaginationDto, plain));
}

describe('PaginationDto', () => {
  it('accepts an empty payload (both fields optional)', async () => {
    expect(await validateDto({})).toHaveLength(0);
  });

  it('accepts valid page and limit', async () => {
    expect(await validateDto({ page: 2, limit: 50 })).toHaveLength(0);
  });

  it('coerces numeric strings via @Type(Number)', async () => {
    const dto = plainToInstance(PaginationDto, { page: '3', limit: '20' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(20);
  });

  it('rejects page below the minimum of 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects a non-integer page', async () => {
    const errors = await validateDto({ page: 1.5 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit above the maximum of 200', async () => {
    const errors = await validateDto({ limit: 201 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects limit below the minimum of 1', async () => {
    const errors = await validateDto({ limit: 0 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects a non-numeric limit', async () => {
    const errors = await validateDto({ limit: 'abc' });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
