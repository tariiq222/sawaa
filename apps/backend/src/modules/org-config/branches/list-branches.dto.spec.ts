import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListBranchesDto } from './list-branches.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListBranchesDto, plain);
  return validate(dto);
}

describe('ListBranchesDto', () => {
  it('accepts an empty payload (all fields optional + inherited pagination)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid search query', async () => {
    const errors = await validateDto({ search: 'Riyadh' });
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" string to boolean (Transform)', async () => {
    const dto = plainToInstance(ListBranchesDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "false" string to boolean (Transform)', async () => {
    const dto = plainToInstance(ListBranchesDto, { isActive: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('coerces isActive = "1" string to boolean (Transform)', async () => {
    const dto = plainToInstance(ListBranchesDto, { isActive: '1' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('accepts an actual boolean isActive', async () => {
    const errors = await validateDto({ isActive: true });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isActive (number)', async () => {
    const errors = await validateDto({ isActive: 42 });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
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

  it('accepts a valid page/limit pair', async () => {
    const errors = await validateDto({ page: 2, limit: 50 });
    expect(errors).toHaveLength(0);
  });
});
