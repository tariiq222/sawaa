import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EmployeeServiceOptionInputDto,
  SetEmployeeServiceOptionsDto,
} from './set-employee-service-options.dto';
import { DeliveryType } from '@prisma/client';

const validateDto = (plain: Record<string, unknown>) =>
  validate(plainToInstance(SetEmployeeServiceOptionsDto, plain));

const validateOption = (plain: Record<string, unknown>) =>
  validate(plainToInstance(EmployeeServiceOptionInputDto, plain));

const validOption = {
  durationOptionId: '550e8400-e29b-41d4-a716-446655440000',
};

describe('SetEmployeeServiceOptionsDto', () => {
  it('accepts a payload with one valid option', async () => {
    const errors = await validateDto({ options: [validOption] });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated option with all override fields', async () => {
    const errors = await validateDto({
      options: [
        {
          ...validOption,
          priceOverride: 45,
          durationOverride: 35,
          deliveryType: DeliveryType.IN_PERSON,
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

  it('rejects an empty options array', async () => {
    const errors = await validateDto({ options: [] });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-array options field', async () => {
    const errors = await validateDto({ options: 'not-an-array' });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-UUID durationOptionId', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, durationOptionId: 'not-a-uuid' }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a negative priceOverride', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, priceOverride: -10 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('accepts a zero priceOverride', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, priceOverride: 0 }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a durationOverride < 1', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, durationOverride: 0 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-integer durationOverride', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, durationOverride: 30.5 }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('accepts an explicit null priceOverride (inherit service default)', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, priceOverride: null }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an explicit null durationOverride (inherit service default)', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, durationOverride: null }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-enum deliveryType', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, deliveryType: 'TELEPATHY' }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({
      options: [{ ...validOption, isActive: 'yes' }],
    });
    expect(errors.some((e) => e.property === 'options')).toBe(true);
  });
});

describe('EmployeeServiceOptionInputDto', () => {
  it('accepts a fully valid instance directly', async () => {
    const errors = await validateOption(validOption);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing durationOptionId when validated directly', async () => {
    const errors = await validateOption({});
    expect(errors.some((e) => e.property === 'durationOptionId')).toBe(true);
  });
});
