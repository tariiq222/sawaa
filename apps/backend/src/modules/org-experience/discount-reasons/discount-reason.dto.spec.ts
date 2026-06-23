import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDiscountReasonDto, UpdateDiscountReasonDto } from './discount-reason.dto';

async function validateDto(plain: Record<string, unknown>, Cls: typeof CreateDiscountReasonDto) {
  const dto = plainToInstance(Cls, plain);
  return validate(dto);
}

describe('CreateDiscountReasonDto', () => {
  it('accepts a minimal valid payload (only required field)', async () => {
    const errors = await validateDto({ labelAr: 'خصم من المعالج' }, CreateDiscountReasonDto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto(
      {
        labelAr: 'خصم من المعالج',
        labelEn: 'Therapist discount',
        isActive: true,
        sortOrder: 0,
      },
      CreateDiscountReasonDto,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing labelAr', async () => {
    const errors = await validateDto({}, CreateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects an empty labelAr', async () => {
    const errors = await validateDto({ labelAr: '' }, CreateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelAr longer than 120 chars', async () => {
    const errors = await validateDto({ labelAr: 'أ'.repeat(121) }, CreateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a non-string labelAr', async () => {
    const errors = await validateDto({ labelAr: 42 }, CreateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelEn longer than 120 chars', async () => {
    const errors = await validateDto(
      { labelAr: 'ح', labelEn: 'A'.repeat(121) },
      CreateDiscountReasonDto,
    );
    expect(errors.some((e) => e.property === 'labelEn')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto(
      { labelAr: 'ح', isActive: 'true' },
      CreateDiscountReasonDto,
    );
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateDto(
      { labelAr: 'ح', sortOrder: -1 },
      CreateDiscountReasonDto,
    );
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('rejects a non-integer sortOrder', async () => {
    const errors = await validateDto(
      { labelAr: 'ح', sortOrder: 1.5 },
      CreateDiscountReasonDto,
    );
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts sortOrder = 0', async () => {
    const errors = await validateDto({ labelAr: 'ح', sortOrder: 0 }, CreateDiscountReasonDto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateDiscountReasonDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({}, UpdateDiscountReasonDto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto(
      {
        labelAr: 'خصم خاص',
        labelEn: 'Special discount',
        isActive: false,
        sortOrder: 1,
      },
      UpdateDiscountReasonDto,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty labelAr when provided', async () => {
    const errors = await validateDto({ labelAr: '' }, UpdateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelAr longer than 120 chars', async () => {
    const errors = await validateDto({ labelAr: 'أ'.repeat(121) }, UpdateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelAr')).toBe(true);
  });

  it('rejects a labelEn longer than 120 chars', async () => {
    const errors = await validateDto({ labelEn: 'A'.repeat(121) }, UpdateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'labelEn')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ isActive: 'false' }, UpdateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateDto({ sortOrder: -5 }, UpdateDiscountReasonDto);
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });
});
