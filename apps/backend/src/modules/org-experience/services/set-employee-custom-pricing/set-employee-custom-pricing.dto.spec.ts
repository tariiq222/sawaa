import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CustomPricingTypeDto,
  SetEmployeeCustomPricingDto,
} from './set-employee-custom-pricing.dto';

const validateDto = (plain: Record<string, unknown>) =>
  validate(plainToInstance(SetEmployeeCustomPricingDto, plain));

const validateType = (plain: Record<string, unknown>) =>
  validate(plainToInstance(CustomPricingTypeDto, plain));

const validPayload: Record<string, unknown> = {
  enabled: true,
  types: [
    { deliveryType: 'IN_PERSON', price: 30000, durationMins: 60 },
    { deliveryType: 'ONLINE', price: 25000, durationMins: 60 },
  ],
};

describe('SetEmployeeCustomPricingDto', () => {
  it('accepts a fully valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('still requires a types array even when disabled (the DTO always requires it)', async () => {
    const errors = await validateDto({ enabled: false });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('accepts disabled with an empty types array (no overrides)', async () => {
    const errors = await validateDto({ enabled: false, types: [] });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing enabled', async () => {
    const errors = await validateDto({ types: [] });
    expect(errors.some((e) => e.property === 'enabled')).toBe(true);
  });

  it('rejects a non-boolean enabled', async () => {
    const errors = await validateDto({ enabled: 'true', types: [] });
    expect(errors.some((e) => e.property === 'enabled')).toBe(true);
  });

  it('rejects a missing types array', async () => {
    const errors = await validateDto({ enabled: true });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a non-array types field', async () => {
    const errors = await validateDto({ enabled: true, types: 'not-an-array' });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a type entry with a negative price', async () => {
    const errors = await validateDto({
      enabled: true,
      types: [{ deliveryType: 'IN_PERSON', price: -1, durationMins: 60 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a type entry with duration < 1', async () => {
    const errors = await validateDto({
      enabled: true,
      types: [{ deliveryType: 'IN_PERSON', price: 100, durationMins: 0 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a type entry with a non-integer price', async () => {
    const errors = await validateDto({
      enabled: true,
      types: [{ deliveryType: 'IN_PERSON', price: 99.99, durationMins: 60 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a type entry with a non-integer durationMins', async () => {
    const errors = await validateDto({
      enabled: true,
      types: [{ deliveryType: 'IN_PERSON', price: 100, durationMins: 30.5 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a type entry with a non-string deliveryType', async () => {
    const errors = await validateDto({
      enabled: true,
      types: [{ deliveryType: 42, price: 100, durationMins: 60 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });
});

describe('CustomPricingTypeDto', () => {
  it('accepts a fully valid instance directly', async () => {
    const errors = await validateType({ deliveryType: 'IN_PERSON', price: 100, durationMins: 60 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing deliveryType directly', async () => {
    const errors = await validateType({ price: 100, durationMins: 60 });
    expect(errors.some((e) => e.property === 'deliveryType')).toBe(true);
  });
});
