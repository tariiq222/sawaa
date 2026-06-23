import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListCategoriesDto } from './list-categories.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListCategoriesDto, plain);
  return validate(dto);
}

describe('ListCategoriesDto', () => {
  it('accepts an empty payload', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid UUID for departmentId', async () => {
    const errors = await validateDto({
      departmentId: '00000000-0000-4000-8000-000000000000',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID string for departmentId', async () => {
    const errors = await validateDto({ departmentId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'departmentId')).toBe(true);
  });

  it('rejects a numeric departmentId', async () => {
    const errors = await validateDto({ departmentId: 42 });
    expect(errors.some((e) => e.property === 'departmentId')).toBe(true);
  });

  it('coerces isActive = "true" to boolean', async () => {
    const dto = plainToInstance(ListCategoriesDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "0" to boolean', async () => {
    const dto = plainToInstance(ListCategoriesDto, { isActive: '0' });
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

  it('rejects a search query longer than 100 chars', async () => {
    const errors = await validateDto({ search: 'a'.repeat(101) });
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

  it('accepts a valid page/limit/departmentId/search combination', async () => {
    const errors = await validateDto({
      page: 1,
      limit: 25,
      departmentId: '00000000-0000-4000-8000-000000000000',
      search: 'cardio',
      isActive: true,
    });
    expect(errors).toHaveLength(0);
  });
});
