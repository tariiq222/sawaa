import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBranchDto } from './update-branch.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateBranchDto, plain);
  return validate(dto);
}

describe('UpdateBranchDto', () => {
  it('accepts an empty payload (all fields are optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update (nameAr only)', async () => {
    const errors = await validateDto({ nameAr: 'فرع جدة' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update (coordinates only)', async () => {
    const errors = await validateDto({ latitude: 21.4858, longitude: 39.1925 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a non-string nameAr', async () => {
    const errors = await validateDto({ nameAr: 42 });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an addressAr longer than 500 chars', async () => {
    const errors = await validateDto({ addressAr: 'أ'.repeat(501) });
    expect(errors.some((e) => e.property === 'addressAr')).toBe(true);
  });

  it('rejects an out-of-range latitude', async () => {
    const errors = await validateDto({ latitude: 91 });
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects a non-numeric latitude', async () => {
    const errors = await validateDto({ latitude: 'abc' });
    expect(errors.some((e) => e.property === 'latitude')).toBe(true);
  });

  it('rejects an out-of-range longitude', async () => {
    const errors = await validateDto({ longitude: -181 });
    expect(errors.some((e) => e.property === 'longitude')).toBe(true);
  });

  it('accepts boundary coordinates', async () => {
    const errors = await validateDto({ latitude: 90, longitude: -180 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isActive (string)', async () => {
    const errors = await validateDto({ isActive: 'false' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a country code longer than 2 chars', async () => {
    const errors = await validateDto({ country: 'SAU' });
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });
});
