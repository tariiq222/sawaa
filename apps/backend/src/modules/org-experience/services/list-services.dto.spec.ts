import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListServicesDto } from './list-services.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListServicesDto, plain);
  return validate(dto);
}

describe('ListServicesDto', () => {
  it('accepts branch and department filters with a global sort', async () => {
    expect(await validateDto({branchId:'550e8400-e29b-41d4-a716-446655440000',departmentId:'550e8400-e29b-41d4-a716-446655440001',sortBy:'price',sortOrder:'asc'})).toHaveLength(0);
  });
  it('rejects invalid filter identifiers and unsupported ordering', async () => {
    const errors=await validateDto({branchId:'bad',departmentId:'bad',sortBy:'arbitrary',sortOrder:'sideways'});
    expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['branchId','departmentId','sortBy','sortOrder']));
  });

  it('accepts an empty payload (all filters optional, pagination defaults)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" to boolean true', async () => {
    const dto = plainToInstance(ListServicesDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces includeHidden = "1" to boolean true', async () => {
    const dto = plainToInstance(ListServicesDto, { includeHidden: '1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.includeHidden).toBe(true);
  });

  it('coerces includeArchived = "0" to boolean false', async () => {
    const dto = plainToInstance(ListServicesDto, { includeArchived: '0' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.includeArchived).toBe(false);
  });

  it('rejects a non-boolean isActive (string that is not "true"/"false")', async () => {
    const errors = await validateDto({ isActive: 'yes' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean includeHidden', async () => {
    const errors = await validateDto({ includeHidden: 'maybe' });
    expect(errors.some((e) => e.property === 'includeHidden')).toBe(true);
  });

  it('rejects a non-boolean includeArchived', async () => {
    const errors = await validateDto({ includeArchived: 'maybe' });
    expect(errors.some((e) => e.property === 'includeArchived')).toBe(true);
  });

  it('rejects a categoryId that is not a UUID', async () => {
    const errors = await validateDto({ categoryId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('accepts a valid categoryId UUID', async () => {
    const errors = await validateDto({ categoryId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a search longer than 100 chars', async () => {
    const errors = await validateDto({ search: 'A'.repeat(101) });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects a non-string search', async () => {
    const errors = await validateDto({ search: 42 });
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('coerces page from string to integer', async () => {
    const dto = plainToInstance(ListServicesDto, { page: '2' });
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
