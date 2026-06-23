import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateIntakeFormDto, IntakeFieldInputDto } from './create-intake-form.dto';
import { IntakeFieldType, IntakeFormScope, IntakeFormType } from '@prisma/client';

const validateCreate = (plain: Record<string, unknown>) =>
  validate(plainToInstance(CreateIntakeFormDto, plain));

const validateField = (plain: Record<string, unknown>) =>
  validate(plainToInstance(IntakeFieldInputDto, plain));

const validPayload: Record<string, unknown> = {
  nameAr: 'استبيان ما قبل الجلسة',
  type: IntakeFormType.PRE_SESSION,
  scope: IntakeFormScope.GLOBAL,
};

describe('CreateIntakeFormDto', () => {
  it('accepts a minimal valid payload (only required fields)', async () => {
    const errors = await validateCreate(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload with fields', async () => {
    const errors = await validateCreate({
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
    const errors = await validateCreate(rest);
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a missing type', async () => {
    const { type: _ignored, ...rest } = validPayload;
    const errors = await validateCreate(rest);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects a missing scope', async () => {
    const { scope: _ignored, ...rest } = validPayload;
    const errors = await validateCreate(rest);
    expect(errors.some((e) => e.property === 'scope')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateCreate({ ...validPayload, nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an out-of-enum type', async () => {
    const errors = await validateCreate({ ...validPayload, type: 'UNEXPECTED' });
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects an out-of-enum scope', async () => {
    const errors = await validateCreate({ ...validPayload, scope: 'TEAM' });
    expect(errors.some((e) => e.property === 'scope')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateCreate({ ...validPayload, isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-string scopeId', async () => {
    const errors = await validateCreate({ ...validPayload, scopeId: 42 });
    expect(errors.some((e) => e.property === 'scopeId')).toBe(true);
  });

  it('accepts a string scopeId', async () => {
    const errors = await validateCreate({ ...validPayload, scopeId: 'service-123' });
    expect(errors).toHaveLength(0);
  });

  it('rejects more than 100 fields', async () => {
    const fields = Array.from({ length: 101 }, (_, i) => ({
      labelAr: `سؤال ${i}`,
      fieldType: IntakeFieldType.TEXT,
    }));
    const errors = await validateCreate({ ...validPayload, fields });
    expect(errors.some((e) => e.property === 'fields')).toBe(true);
  });

  it('accepts exactly 100 fields', async () => {
    const fields = Array.from({ length: 100 }, (_, i) => ({
      labelAr: `سؤال ${i}`,
      fieldType: IntakeFieldType.TEXT,
    }));
    const errors = await validateCreate({ ...validPayload, fields });
    expect(errors).toHaveLength(0);
  });
});

describe('IntakeFieldInputDto', () => {
  it('accepts a valid text field directly', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing labelAr', async () => {
    const errors = await validateField({ fieldType: IntakeFieldType.TEXT });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a missing fieldType', async () => {
    const errors = await validateField({ labelAr: 'سؤال' });
    expect(errors.some((e) => e.property === 'fieldType')).toBe(true);
  });

  it('rejects an out-of-enum fieldType', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: 'RATING' });
    expect(errors.some((e) => e.property === 'fieldType')).toBe(true);
  });

  it('rejects a labelAr longer than 200 chars', async () => {
    const errors = await validateField({ labelAr: 'أ'.repeat(201), fieldType: IntakeFieldType.TEXT });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a non-boolean isRequired', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, isRequired: 'yes' });
    expect(errors.some((e) => e.property === 'isRequired')).toBe(true);
  });

  it('rejects a non-string-array options field', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: IntakeFieldType.SELECT, options: [1, 2, 3] });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('accepts a valid string-array options field', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: IntakeFieldType.SELECT, options: ['a', 'b'] });
    expect(errors).toHaveLength(0);
  });

  it('rejects a negative position', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, position: -1 });
    expect(errors.some((e) => e.property === 'position')).toBe(true);
  });

  it('rejects a non-integer position', async () => {
    const errors = await validateField({ labelAr: 'سؤال', fieldType: IntakeFieldType.TEXT, position: 1.5 });
    expect(errors.some((e) => e.property === 'position')).toBe(true);
  });
});
