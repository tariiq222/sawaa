import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDepartmentDto } from './create-department.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateDepartmentDto, plain);
  return validate(dto);
}

describe('CreateDepartmentDto', () => {
  const valid: Record<string, unknown> = { nameAr: 'قسم الأسنان' };

  it('accepts a minimal payload (only required field)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      ...valid,
      nameEn: 'Dental Department',
      descriptionAr: 'قسم طب وجراحة الفم والأسنان',
      descriptionEn: 'Oral and dental surgery department',
      icon: 'tooth',
      isActive: true,
      isVisible: true,
      sortOrder: 2,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing nameAr', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ ...valid, nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a whitespace-only nameAr (Matches /\\S/)', async () => {
    const errors = await validateDto({ ...valid, nameAr: '   ' });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ ...valid, nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a whitespace-only nameEn when provided', async () => {
    const errors = await validateDto({ ...valid, nameEn: '   ' });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('accepts a nameEn with leading/trailing whitespace around content', async () => {
    const errors = await validateDto({ ...valid, nameEn: '  Dental  ' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a descriptionAr longer than 1000 chars', async () => {
    const errors = await validateDto({ ...valid, descriptionAr: 'أ'.repeat(1001) });
    expect(errors.some((e) => e.property === 'descriptionAr')).toBe(true);
  });

  it('rejects an icon longer than 100 chars', async () => {
    const errors = await validateDto({ ...valid, icon: 'i'.repeat(101) });
    expect(errors.some((e) => e.property === 'icon')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ ...valid, isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isVisible', async () => {
    const errors = await validateDto({ ...valid, isVisible: 1 });
    expect(errors.some((e) => e.property === 'isVisible')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateDto({ ...valid, sortOrder: -1 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts a sortOrder of 0 (boundary)', async () => {
    const errors = await validateDto({ ...valid, sortOrder: 0 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-integer sortOrder', async () => {
    const errors = await validateDto({ ...valid, sortOrder: 1.5 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });
});
