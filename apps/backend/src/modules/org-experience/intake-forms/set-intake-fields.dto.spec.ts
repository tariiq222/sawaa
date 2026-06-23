import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetIntakeFieldsDto } from './set-intake-fields.dto';
import { IntakeFieldType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SetIntakeFieldsDto, plain);
  return validate(dto);
}

describe('SetIntakeFieldsDto', () => {
  it('accepts a missing fields (omitted → clear all)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty fields array (clear all)', async () => {
    const errors = await validateDto({ fields: [] });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid fields array', async () => {
    const errors = await validateDto({
      fields: [
        { labelAr: 'سؤال ١', fieldType: IntakeFieldType.TEXT },
        { labelAr: 'سؤال ٢', fieldType: IntakeFieldType.SELECT, options: ['نعم', 'لا'] },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-array fields field', async () => {
    const errors = await validateDto({ fields: 'not-an-array' });
    expect(errors.some((e) => e.property === 'fields')).toBe(true);
  });

  it('rejects more than 100 fields', async () => {
    const fields = Array.from({ length: 101 }, (_, i) => ({
      labelAr: `سؤال ${i}`,
      fieldType: IntakeFieldType.TEXT,
    }));
    const errors = await validateDto({ fields });
    expect(errors.some((e) => e.property === 'fields')).toBe(true);
  });

  it('accepts exactly 100 fields', async () => {
    const fields = Array.from({ length: 100 }, (_, i) => ({
      labelAr: `سؤال ${i}`,
      fieldType: IntakeFieldType.TEXT,
    }));
    const errors = await validateDto({ fields });
    expect(errors).toHaveLength(0);
  });

  it('rejects a nested field with an out-of-enum fieldType', async () => {
    const errors = await validateDto({
      fields: [{ labelAr: 'سؤال', fieldType: 'RATING' }],
    });
    expect(errors.some((e) => e.property === 'fields')).toBe(true);
  });

  it('rejects a nested field with a missing labelAr', async () => {
    const errors = await validateDto({
      fields: [{ fieldType: IntakeFieldType.TEXT }],
    });
    expect(errors.some((e) => e.property === 'fields')).toBe(true);
  });
});
