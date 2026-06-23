import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListDepartmentsDto } from './list-departments.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListDepartmentsDto, plain);
  return validate(dto);
}

describe('ListDepartmentsDto', () => {
  it('accepts an empty payload', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" to boolean', async () => {
    const dto = plainToInstance(ListDepartmentsDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "false" to boolean', async () => {
    const dto = plainToInstance(ListDepartmentsDto, { isActive: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('rejects a non-boolean isActive (object)', async () => {
    const errors = await validateDto({ isActive: { raw: 'true' } });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('accepts a valid search query', async () => {
    const errors = await validateDto({ search: 'dental' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a search query longer than 200 chars', async () => {
    const errors = await validateDto({ search: 'a'.repeat(201) });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects a non-string search', async () => {
    const errors = await validateDto({ search: 42 });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects a page below 1 (pagination inheritance)', async () => {
    const errors = await validateDto({ page: 0 });
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects a limit above 200 (pagination inheritance)', async () => {
    const errors = await validateDto({ limit: 500 });
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('accepts a valid page/limit/search/isActive combination', async () => {
    const errors = await validateDto({
      page: 1,
      limit: 50,
      search: 'cardio',
      isActive: true,
    });
    expect(errors).toHaveLength(0);
  });
});
