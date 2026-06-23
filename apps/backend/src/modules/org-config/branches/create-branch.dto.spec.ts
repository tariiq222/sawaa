import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBranchDto } from './create-branch.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateBranchDto, plain);
  return validate(dto);
}

describe('CreateBranchDto', () => {
  const valid: Record<string, unknown> = { nameAr: 'فرع الرياض' };

  it('accepts a minimal valid payload (only required field)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      ...valid,
      nameEn: 'Riyadh Branch',
      phone: '+966112345678',
      addressAr: 'شارع الملك فهد، الرياض',
      addressEn: 'King Fahd Road, Riyadh',
      city: 'Riyadh',
      country: 'SA',
      latitude: 24.7136,
      longitude: 46.6753,
      isActive: true,
      isMain: false,
      timezone: 'Asia/Riyadh',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing nameAr', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const tooLong = 'أ'.repeat(201);
    const errors = await validateDto({ ...valid, nameAr: tooLong });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ ...valid, nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a nameEn longer than 200 chars', async () => {
    const tooLong = 'A'.repeat(201);
    const errors = await validateDto({ ...valid, nameEn: tooLong });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a phone longer than 30 chars', async () => {
    const tooLong = '1'.repeat(31);
    const errors = await validateDto({ ...valid, phone: tooLong });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects a city longer than 100 chars', async () => {
    const tooLong = 'A'.repeat(101);
    const errors = await validateDto({ ...valid, city: tooLong });
    expect(errors.some((e) => e.property === 'city')).toBe(true);
  });

  it('rejects a country code longer than 2 chars', async () => {
    const errors = await validateDto({ ...valid, country: 'SAU' });
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });

  it('rejects an out-of-range latitude (>90)', async () => {
    const errors = await validateDto({ ...valid, latitude: 91 });
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects an out-of-range latitude (<-90)', async () => {
    const errors = await validateDto({ ...valid, latitude: -91 });
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects a non-numeric latitude', async () => {
    const errors = await validateDto({ ...valid, latitude: 'not-a-number' });
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('accepts a latitude at the boundary (exactly 90)', async () => {
    const errors = await validateDto({ ...valid, latitude: 90 });
    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-range longitude (>180)', async () => {
    const errors = await validateDto({ ...valid, longitude: 181 });
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('rejects an out-of-range longitude (<-180)', async () => {
    const errors = await validateDto({ ...valid, longitude: -181 });
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('accepts a longitude at the boundary (exactly 180)', async () => {
    const errors = await validateDto({ ...valid, longitude: 180 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isActive (string)', async () => {
    const errors = await validateDto({ ...valid, isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isMain (number)', async () => {
    const errors = await validateDto({ ...valid, isMain: 1 });
    expect(errors.some((e) => e.property === 'isMain')).toBe(true);
  });
});
