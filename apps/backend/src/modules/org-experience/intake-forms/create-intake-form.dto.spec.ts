import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIntakeFormDto, IntakeFieldInputDto } from './create-intake-form.dto';
import { IntakeFieldType, IntakeFormScope, IntakeFormType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>, Cls = CreateIntakeFormDto) {
  const dto = plainToInstance(Cls, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  nameAr: 'استبيان ما قبل الجلسة',
  type: IntakeFormType.PRE_SESSION,
  scope: IntakeFormScope.GLOBAL,
};

describe('CreateIntakeFormDto', () => {
  it('accepts a minimal valid payload (only required fields)', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload with fields', async () => {
    const errors = await validateDto({
      ...validPayload,
      nameEn: 'Pre-session Questionnaire',
      scopeId: null,
      isActive: true,
      fields: [
        {
          labelAr: 'هل لديك حساسية؟',
          labelEn: 'Do you have any allergies?',
          fieldType: IntakeFieldType.TEXT,
          isRequired: true,
          options: ['نعم', 'لا'],
          position: 0,
        },
        {
          labelAr: 'نوع الحساسية',
          fieldType: IntakeFieldType.SELECT,
          isRequired: false,
          options: ['طعام', 'دواء'],
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing nameAr', async () => {
    const { nameAr: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a missing type', async () => {
    const { type: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects a missing scope', async () => {
    const { scope: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'scope')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ ...validPayload, nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an out-of-enum type', async () => {
    const errors = await validateDto({ ...validPayload, type: 'UNEXPECTED' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects an out-of-enum scope', async () => {
    const errors = await validateDto({ ...validPayload, scope: 'TEAM' });
    expect(errors.some((e) => e.property === 'scope')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ ...validPayload, isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-string scopeId', async () => {
    const errors = await validateDto({ ...validPayload, scopeId: 42 });
    expect(errors.some((e) => e.property === 'scopeId')).toBe(true);
  });

  it('accepts a string scopeId', async () => {
    const errors = await validateDto({ ...validPayload, scopeId: 'service-123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects more than 100 fields', async () => {
    const fields = Array.from({ length: 101 }, (_, i) => ({
      labelAr: `سؤال ${i}`,
      fieldType: IntakeFieldType.TEXT,
    }));
    const errors = await validateDto({ ...validPayload, fields });
    expect(errors.some((e) => e.property === 'fields')).toBe(true);
  });

  it('accepts exactly 100 fields', async () => {
    const fields = Array.from({ length: 100 }, (_, i) => ({
      labelAr: `سؤال ${i}`,
      fieldType: IntakeFieldType.TEXT,
    }));
    const errors = await validateDto({ ...validPayload, fields });
    expect(errors).toHaveLength(0);
  });
});

describe('IntakeFieldInputDto', () => {
  it('accepts a valid text field directly', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT },
      IntakeFieldInputDto,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing labelAr', async () => {
    const errors = await validateDto(
      { fieldType: IntakeFieldType.TEXT },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a missing fieldType', async () => {
    const errors = await validateDto({ labelAr: 'سؤال' }, IntakeFieldInputDto);
    expect(errors.some((e) => e.property === 'fieldType')).toBe(true);
  });

  it('rejects an out-of-enum fieldType', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: 'RATING' },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'fieldType')).toBe(true);
  });

  it('rejects a labelAr longer than 200 chars', async () => {
    const errors = await validateDto(
      { labelAr: 'أ'.repeat(201), fieldType: IntakeFieldType.TEXT },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a non-boolean isRequired', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, isRequired: 'yes' },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'isRequired')).toBe(true);
  });

  it('rejects a non-string-array options field', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: IntakeFieldType.SELECT, options: [1, 2, 3] },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('accepts a valid string-array options field', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: IntakeFieldType.SELECT, options: ['a', 'b'] },
      IntakeFieldInputDto,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative position', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, position: -1 },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'position')).toBe(true);
  });

  it('rejects a non-integer position', async () => {
    const errors = await validateDto(
      { labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, position: 1.5 },
      IntakeFieldInputDto,
    );
    expect(errors.some((e) => e.property === 'position')).toBe(true);
  });
});
