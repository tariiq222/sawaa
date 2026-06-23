import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DurationOptionInputDto, SetDurationOptionsDto } from './set-duration-options.dto';
import { DeliveryType } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>, Cls = SetDurationOptionsDto) {
  const dto = plainToInstance(Cls, plain);
  return validate(dto);
}

const validOption = {
  label: '30 min',
  labelAr: '30 دقيقة',
  durationMins: 30,
  price: 5000,
};

describe('SetDurationOptionsDto', () => {
  it('accepts a payload with one valid option', async () => {
    const errors = await validateDto({ options: [validOption] });
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with multiple valid options', async () => {
    const errors = await validateDto({
      options: [
        validOption,
        { ...validOption, label: '60 min', labelAr: '60 دقيقة', durationMins: 60, price: 9000 },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated option with all optional fields', async () => {
    const errors = await validateDto({
      options: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          deliveryType: DeliveryType.IN_PERSON,
          ...validOption,
          currency: 'SAR',
          isDefault: true,
          sortOrder: 0,
          isActive: true,
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing options array', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects an empty options array (at least one required)', async () => {
    const errors = await validateDto({ options: [] });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-array options field', async () => {
    const errors = await validateDto({ options: 'not-an-array' });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a label longer than 100 chars', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, label: 'A'.repeat(101) }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a labelAr longer than 100 chars', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, labelAr: 'أ'.repeat(101) }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a missing label', async () => {
    const { label: _ignored, ...rest } = validOption;
    const errors = await validateDto({ options: [rest] });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a duration < 1', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, durationMins: 0 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-integer duration', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, durationMins: 30.5 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a negative price', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, price: -1 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-integer price', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, price: 99.99 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects an out-of-enum deliveryType', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, deliveryType: 'TELEPATHY' }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('accepts an explicit null deliveryType (service-agnostic option)', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, deliveryType: null }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isDefault', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, isDefault: 'true' }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a negative sortOrder', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, sortOrder: -1 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-UUID id', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, id: 'not-a-uuid' }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });
});

describe('DurationOptionInputDto', () => {
  it('accepts a fully valid instance directly', async () => {
    const errors = await validateDto(validOption, DurationOptionInputDto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing label when validated directly', async () => {
    const { label: _ignored, ...rest } = validOption;
    const errors = await validateDto(rest, DurationOptionInputDto);
    expect(errors.some((e) => e.property === 'label')).toBe(true);
  });
});
