import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateCategoryDto, plain);
  return validate(dto);
}

describe('CreateCategoryDto', () => {
  const valid: Record<string, unknown> = { nameAr: 'طب الأسنان' };

  it('accepts a minimal payload (only required field)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      ...valid,
      nameEn: 'Dentistry',
      departmentId: '00000000-0000-4000-8000-000000000000',
      sortOrder: 1,
      bookingMode: 'SERVICES',
      imageUrl: 'https://example.com/cat.png',
      iconName: 'tooth',
      iconBgColor: '#F0F4FF',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing nameAr', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ ...valid, nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const tooLong = 'أ'.repeat(201);
    const errors = await validateDto({ ...valid, nameAr: tooLong });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an invalid UUID for departmentId', async () => {
    const errors = await validateDto({ ...valid, departmentId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'departmentId')).toBe(true);
  });

  it('rejects a negative sortOrder (below min)', async () => {
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

  it('rejects an unknown bookingMode', async () => {
    const errors = await validateDto({ ...valid, bookingMode: 'HYBRID' });
    expect(errors.some((e) => e.property === 'bookingMode')).toBe(true);
  });

  it('accepts the DIRECT bookingMode enum value', async () => {
    const errors = await validateDto({ ...valid, bookingMode: 'DIRECT' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an iconName longer than 50 chars', async () => {
    const errors = await validateDto({ ...valid, iconName: 'A'.repeat(51) });
    expect(errors.some((e) => e.property === 'iconName')).toBe(true);
  });

  it('rejects an iconBgColor longer than 20 chars', async () => {
    const errors = await validateDto({ ...valid, iconBgColor: '#'.repeat(21) });
    expect(errors.some((e) => e.property === 'iconBgColor')).toBe(true);
  });
});
