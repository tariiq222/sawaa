import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListRatingsDto } from './list-ratings.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListRatingsDto, plain);
  return validate(dto);
}

describe('ListRatingsDto', () => {
  it('accepts an empty payload (pagination defaults)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      employeeId: '550e8400-e29b-41d4-a716-446655440002',
      clientId: '550e8400-e29b-41d4-a716-446655440001',
      page: 1,
      limit: 50,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID employeeId', async () => {
    const errors = await validateDto({ employeeId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'employeeId')).toBe(true);
  });

  it('rejects a non-UUID clientId', async () => {
    const errors = await validateDto({ clientId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'clientId')).toBe(true);
  });

  it('coerces page from string to integer', async () => {
    const dto = plainToInstance(ListRatingsDto, { page: '2' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
  });

  it('rejects page < 1', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects limit > 200', async () => {
    const errors = await validateDto({ limit: 201 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
