import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBundleDto } from './update-bundle.dto';
import { DiscountType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateBundleDto, plain);
  return validate(dto);
}

describe('UpdateBundleDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      nameAr: 'باقة العناية الشاملة',
      nameEn: 'Full Care Bundle',
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
      imageUrl: 'https://example.com/bundle.png',
      iconName: 'bundle-01',
      iconBgColor: '#F0F4FF',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      currency: 'SAR',
      isActive: true,
      isHidden: false,
      sortOrder: 1,
      serviceIds: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameEn longer than 200 chars', async () => {
    const errors = await validateDto({ nameEn: 'A'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an out-of-enum discountType', async () => {
    const errors = await validateDto({ discountType: 'UNKNOWN' });
    expect(errors.some((e) => e.property === 'discountType')).toBe(true);
  });

  it('rejects a negative discountValue', async () => {
    const errors = await validateDto({ discountValue: -1 });
    expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
  });

  it('rejects a non-numeric discountValue', async () => {
    const errors = await validateDto({ discountValue: 'lots' });
    expect(errors.some((e) => e.property === 'discountValue')).toBe(true);
  });

  it('accepts a zero discountValue', async () => {
    const errors = await validateDto({ discountValue: 0 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a currency longer than 8 chars', async () => {
    const errors = await validateDto({ currency: 'A'.repeat(9) });
    expect(errors.some((e) => e.property === 'currency')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isHidden', async () => {
    const errors = await validateDto({ isHidden: 1 });
    expect(errors.some((e) => e.property === 'isHidden')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateDto({ sortOrder: -1 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('rejects a non-integer sortOrder', async () => {
    const errors = await validateDto({ sortOrder: 1.5 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('rejects an iconName longer than 50 chars', async () => {
    const errors = await validateDto({ iconName: 'A'.repeat(51) });
    expect(errors.some((e) => e.property === 'iconName')).toBe(true);
  });

  it('rejects an iconBgColor longer than 20 chars', async () => {
    const errors = await validateDto({ iconBgColor: 'A'.repeat(21) });
    expect(errors.some((e) => e.property === 'iconBgColor')).toBe(true);
  });

  it('rejects serviceIds with fewer than 2 items', async () => {
    const errors = await validateDto({
      serviceIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });
    expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
  });

  it('rejects an empty serviceIds array', async () => {
    const errors = await validateDto({ serviceIds: [] });
    expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
  });

  it('rejects a serviceIds array containing an invalid UUID', async () => {
    const errors = await validateDto({
      serviceIds: ['550e8400-e29b-41d4-a716-446655440000', 'not-a-uuid'],
    });
    expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
  });

  it('rejects a non-array serviceIds', async () => {
    const errors = await validateDto({ serviceIds: 'not-an-array' });
    expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
  });
});
