import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateIntakeFormDto } from './update-intake-form.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateIntakeFormDto, plain);
  return validate(dto);
}

describe('UpdateIntakeFormDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      nameAr: 'استبيان ما قبل الجلسة',
      nameEn: 'Pre-session Questionnaire',
      isActive: true,
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

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });
});
