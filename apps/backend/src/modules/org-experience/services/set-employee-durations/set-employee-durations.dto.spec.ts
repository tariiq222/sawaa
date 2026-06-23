import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  EmployeeDurationItemDto,
  EmployeeDurationsByTypeDto,
  SetEmployeeDurationsDto,
} from './set-employee-durations.dto';

const validateDto = (plain: Record<string, unknown>) =>
  validate(plainToInstance(SetEmployeeDurationsDto, plain));

const validateItem = (plain: Record<string, unknown>) =>
  validate(plainToInstance(EmployeeDurationItemDto, plain));

const validateGroup = (plain: Record<string, unknown>) =>
  validate(plainToInstance(EmployeeDurationsByTypeDto, plain));

const validItem = {
  label: '60 min session',
  labelAr: 'جلسة 60 دقيقة',
  durationMins: 60,
  price: 30000,
};

describe('SetEmployeeDurationsDto', () => {
  it('accepts a valid payload with one duration group', async () => {
    const errors = await validateDto({
      durations: [{ deliveryType: 'IN_PERSON', items: [validItem] }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a payload with multiple delivery types', async () => {
    const errors = await validateDto({
      durations: [
        { deliveryType: 'IN_PERSON', items: [validItem] },
        { deliveryType: 'ONLINE', items: [{ ...validItem, price: 25000 }] },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts an item with an existing UUID id', async () => {
    const errors = await validateDto({
      durations: [
        {
          deliveryType: 'IN_PERSON',
          items: [{ id: '550e8400-e29b-41d4-a716-446655440000', ...validItem }],
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing durations array', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a non-array durations field', async () => {
    const errors = await validateDto({ durations: 'not-an-array' });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a non-UUID id', async () => {
    const errors = await validateDto({
      durations: [
        {
          deliveryType: 'IN_PERSON',
          items: [{ id: 'not-a-uuid', ...validItem }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a missing label', async () => {
    const { label: _ignored, ...rest } = validItem;
    const errors = await validateDto({
      durations: [{ deliveryType: 'IN_PERSON', items: [rest] }],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a missing labelAr', async () => {
    const { labelAr: _ignored, ...rest } = validItem;
    const errors = await validateDto({
      durations: [{ deliveryType: 'IN_PERSON', items: [rest] }],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a missing durationMins', async () => {
    const { durationMins: _ignored, ...rest } = validItem;
    const errors = await validateDto({
      durations: [{ deliveryType: 'IN_PERSON', items: [rest] }],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a missing price', async () => {
    const { price: _ignored, ...rest } = validItem;
    const errors = await validateDto({
      durations: [{ deliveryType: 'IN_PERSON', items: [rest] }],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a non-integer price', async () => {
    const errors = await validateDto({
      durations: [
        {
          deliveryType: 'IN_PERSON',
          items: [{ ...validItem, price: 99.99 }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with a negative price', async () => {
    const errors = await validateDto({
      durations: [
        {
          deliveryType: 'IN_PERSON',
          items: [{ ...validItem, price: -1 }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a duration item with durationMins < 1', async () => {
    const errors = await validateDto({
      durations: [
        {
          deliveryType: 'IN_PERSON',
          items: [{ ...validItem, durationMins: 0 }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });

  it('rejects a non-string deliveryType on the group', async () => {
    const errors = await validateDto({
      durations: [{ deliveryType: 42, items: [validItem] }],
    });
    expect(errors.some((e) => e.property === 'durations')).toBe(true);
  });
});

describe('EmployeeDurationItemDto', () => {
  it('accepts a valid item directly', async () => {
    const errors = await validateItem(validItem);
    expect(errors).toHaveLength(0);
  });
});

describe('EmployeeDurationsByTypeDto', () => {
  it('accepts a valid group directly', async () => {
    const errors = await validateGroup({ deliveryType: 'IN_PERSON', items: [validItem] });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing items array directly', async () => {
    const errors = await validateGroup({ deliveryType: 'IN_PERSON' });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });
});
