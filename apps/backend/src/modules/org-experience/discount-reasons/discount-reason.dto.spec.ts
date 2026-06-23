import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDiscountReasonDto, UpdateDiscountReasonDto } from './discount-reason.dto';

const validateCreate = (plain: Record<string, unknown>) =>
  validate(plainToInstance(CreateDiscountReasonDto, plain));

const validateUpdate = (plain: Record<string, unknown>) =>
  validate(plainToInstance(UpdateDiscountReasonDto, plain));

describe('CreateDiscountReasonDto', () => {
  it('accepts a minimal valid payload (only required field)', async () => {
    const errors = await validateCreate({ labelAr: 'خصم من المعالج' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateCreate({
      labelAr: 'خصم من المعالج',
      labelEn: 'Therapist discount',
      isActive: true,
      sortOrder: 0,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing labelAr', async () => {
    const errors = await validateCreate({});
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects an empty labelAr', async () => {
    const errors = await validateCreate({ labelAr: '' });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelAr longer than 120 chars', async () => {
    const errors = await validateCreate({ labelAr: 'أ'.repeat(121) });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a non-string labelAr', async () => {
    const errors = await validateCreate({ labelAr: 42 });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelEn longer than 120 chars', async () => {
    const errors = await validateCreate({ labelAr: 'ح', labelEn: 'A'.repeat(121) });
    expect(errors.some((e) => e.property === 'labelEn')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateCreate({ labelAr: 'ح', isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateCreate({ labelAr: 'ح', sortOrder: -1 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('rejects a non-integer sortOrder', async () => {
    const errors = await validateCreate({ labelAr: 'ح', sortOrder: 1.5 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts sortOrder = 0', async () => {
    const errors = await validateCreate({ labelAr: 'ح', sortOrder: 0 });
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateDiscountReasonDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateUpdate({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateUpdate({
      labelAr: 'خصم خاص',
      labelEn: 'Special discount',
      isActive: false,
      sortOrder: 1,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty labelAr when provided', async () => {
    const errors = await validateUpdate({ labelAr: '' });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelAr longer than 120 chars', async () => {
    const errors = await validateUpdate({ labelAr: 'أ'.repeat(121) });
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelEn longer than 120 chars', async () => {
    const errors = await validateUpdate({ labelEn: 'A'.repeat(121) });
    expect(errors.some((e) => e.property === 'labelEn')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateUpdate({ isActive: 'false' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateUpdate({ sortOrder: -5 });
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });
});
