import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListEmployeesDto } from './list-employees.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ListEmployeesDto, plain);
  return validate(dto);
}

describe('ListEmployeesDto', () => {
  it('accepts an empty payload', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('coerces isActive = "true" to boolean true', async () => {
    const dto = plainToInstance(ListEmployeesDto, { isActive: 'true' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('coerces isActive = "false" to boolean false', async () => {
    const dto = plainToInstance(ListEmployeesDto, { isActive: 'false' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it('rejects a non-boolean isActive (string that is not "true"/"false")', async () => {
    const errors = await validateDto({ isActive: 'yes' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects an out-of-enum employmentType', async () => {
    const errors = await validateDto({ employmentType: 'INTERN' });
    expect(errors.some((e) => e.property === 'employmentType')).toBe(true);
  });

  it('rejects an out-of-enum onboardingStatus', async () => {
    const errors = await validateDto({ onboardingStatus: 'FAILED' });
    expect(errors.some((e) => e.property === 'onboardingStatus')).toBe(true);
  });

  it('accepts a valid onboardingStatus', async () => {
    const errors = await validateDto({ onboardingStatus: 'COMPLETED' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a branchId that is not a UUID', async () => {
    const errors = await validateDto({ branchId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('accepts a valid branchId UUID', async () => {
    const errors = await validateDto({ branchId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-set sortBy', async () => {
    const errors = await validateDto({ sortBy: 'random' });
    expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
  });

  it('accepts each allowed sortBy value', async () => {
    for (const sortBy of ['name', 'experience', 'isActive', 'createdAt']) {
      const errors = await validateDto({ sortBy });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an out-of-set sortOrder', async () => {
    const errors = await validateDto({ sortOrder: 'random' });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts sortOrder = "asc"', async () => {
    const errors = await validateDto({ sortOrder: 'asc' });
    expect(errors).toHaveLength(0);
  });

  it('accepts sortOrder = "desc"', async () => {
    const errors = await validateDto({ sortOrder: 'desc' });
    expect(errors).toHaveLength(0);
  });

  it('coerces page from string to integer', async () => {
    const dto = plainToInstance(ListEmployeesDto, { page: '3' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
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
