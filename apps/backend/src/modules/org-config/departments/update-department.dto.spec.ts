import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateDepartmentDto } from './update-department.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateDepartmentDto, plain);
  return validate(dto);
}

describe('UpdateDepartmentDto', () => {
  it('accepts an empty payload (all fields are optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update (nameAr only)', async () => {
    const errors = await validateDto({ nameAr: 'قسم القلب' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a whitespace-only nameAr (Matches /\\S/)', async () => {
    const errors = await validateDto({ nameAr: '   ' });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a whitespace-only nameEn when provided', async () => {
    const errors = await validateDto({ nameEn: '   ' });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a descriptionEn longer than 1000 chars', async () => {
    const errors = await validateDto({ descriptionEn: 'E'.repeat(1001) });
    expect(errors.some((e) => e.property === 'descriptionEn')).toBe(true);
  });

  it('rejects a non-boolean isVisible', async () => {
    const errors = await validateDto({ isVisible: 'true' });
    expect(errors.some((e) => e.property === 'isVisible')).toBe(true);
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
});
