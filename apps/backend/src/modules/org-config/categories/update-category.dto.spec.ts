import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCategoryDto } from './update-category.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateCategoryDto, plain);
  return validate(dto);
}

describe('UpdateCategoryDto', () => {
  it('accepts an empty payload (all fields are optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update (nameAr only)', async () => {
    const errors = await validateDto({ nameAr: 'قسم القلب' });
    expect(errors).toHaveLength(0);
  });

  it('accepts null departmentId to unlink from a department (ValidateIf bypasses @IsUUID when value is null)', async () => {
    const errors = await validateDto({ departmentId: null });
    expect(errors.some((e) => e.property === 'departmentId')).toBe(false);
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

  it('rejects a negative sortOrder', async () => {
    const errors = await validateDto({ sortOrder: -1 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts a sortOrder of 0 (boundary)', async () => {
    const errors = await validateDto({ sortOrder: 0 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-integer sortOrder', async () => {
    const errors = await validateDto({ sortOrder: 2.5 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('rejects an unknown bookingMode enum value', async () => {
    const errors = await validateDto({ bookingMode: 'HYBRID' });
    expect(errors.some((e) => e.property === 'bookingMode')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });
});
