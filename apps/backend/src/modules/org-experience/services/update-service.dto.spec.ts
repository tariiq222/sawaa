import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateServiceDto } from './update-service.dto';

const errorsFor = async (overrides: Record<string, unknown>) => {
  const dto = plainToInstance(UpdateServiceDto, overrides);
  return validate(dto);
};

describe('UpdateServiceDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await errorsFor({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await errorsFor({
      nameAr: 'قص الشعر',
      nameEn: 'Haircut',
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
      durationMins: 30,
      price: 12000,
      currency: 'SAR',
      imageUrl: 'https://example.com/logo.png',
      categoryId: '550e8400-e29b-41d4-a716-446655440000',
      isActive: true,
      isHidden: false,
      hidePriceOnBooking: false,
      hideDurationOnBooking: false,
      iconName: 'scissors-01',
      iconBgColor: '#F0F4FF',
      bufferMinutes: 10,
      minLeadMinutes: 60,
      maxAdvanceDays: 30,
      depositEnabled: false,
      expectedUpdatedAt: '2026-06-08T10:00:00.000Z',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await errorsFor({ nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an empty nameAr', async () => {
    const errors = await errorsFor({ nameAr: '' });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameEn longer than 200 chars', async () => {
    const errors = await errorsFor({ nameEn: 'A'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a duration < 1', async () => {
    const errors = await errorsFor({ durationMins: 0 });
    expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
  });

  it('rejects a negative price', async () => {
    const errors = await errorsFor({ price: -1 });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects a non-integer price', async () => {
    const errors = await errorsFor({ price: 1.5 });
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects a non-UUID categoryId', async () => {
    const errors = await errorsFor({ categoryId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await errorsFor({ isActive: 'yes' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isHidden', async () => {
    const errors = await errorsFor({ isHidden: 1 });
    expect(errors.some((e) => e.property === 'isHidden')).toBe(true);
  });

  it('rejects a negative bufferMinutes', async () => {
    const errors = await errorsFor({ bufferMinutes: -1 });
    expect(errors.some((e) => e.property === 'bufferMinutes')).toBe(true);
  });

  it('rejects a negative minLeadMinutes', async () => {
    const errors = await errorsFor({ minLeadMinutes: -1 });
    expect(errors.some((e) => e.property === 'minLeadMinutes')).toBe(true);
  });

  it('rejects maxAdvanceDays < 1', async () => {
    const errors = await errorsFor({ maxAdvanceDays: 0 });
    expect(errors.some((e) => e.property === 'maxAdvanceDays')).toBe(true);
  });

  it('rejects a non-boolean depositEnabled', async () => {
    const errors = await errorsFor({ depositEnabled: 'true' });
    expect(errors.some((e) => e.property === 'depositEnabled')).toBe(true);
  });

  it('rejects a missing depositAmount when depositEnabled = true', async () => {
    const errors = await errorsFor({ depositEnabled: true });
    expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
  });

  it('rejects a depositAmount < 1 when depositEnabled = true', async () => {
    const errors = await errorsFor({ depositEnabled: true, depositAmount: 0 });
    expect(errors.some((e) => e.property === 'depositAmount')).toBe(true);
  });

  it('accepts a valid integer depositAmount when depositEnabled = true', async () => {
    const errors = await errorsFor({ depositEnabled: true, depositAmount: 5000 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-ISO expectedUpdatedAt', async () => {
    const errors = await errorsFor({ expectedUpdatedAt: 'not-iso' });
    expect(errors.some((e) => e.property === 'expectedUpdatedAt')).toBe(true);
  });

  it('accepts a valid ISO expectedUpdatedAt', async () => {
    const errors = await errorsFor({ expectedUpdatedAt: '2026-06-08T10:00:00.000Z' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an iconName longer than 50 chars', async () => {
    const errors = await errorsFor({ iconName: 'A'.repeat(51) });
    expect(errors.some((e) => e.property === 'iconName')).toBe(true);
  });

  it('rejects an iconBgColor longer than 20 chars', async () => {
    const errors = await errorsFor({ iconBgColor: 'A'.repeat(21) });
    expect(errors.some((e) => e.property === 'iconBgColor')).toBe(true);
  });

  describe('@SanitizeText', () => {
    it('strips a script tag from nameAr', () => {
      const dto = plainToInstance(UpdateServiceDto, { nameAr: '<script>x</script>' });
      expect(dto.nameAr).toBe('x');
    });

    it('strips tags from descriptionEn', () => {
      const dto = plainToInstance(UpdateServiceDto, { descriptionEn: '  <i>fine</i>  ' });
      expect(dto.descriptionEn).toBe('fine');
    });
  });
});
