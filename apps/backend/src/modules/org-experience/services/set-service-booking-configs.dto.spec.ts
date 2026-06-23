import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BookingConfigDurationOptionInputDto,
  BookingConfigInputDto,
  ServiceAvailabilityWindowInputDto,
  SetServiceBookingConfigsDto,
} from './set-service-booking-configs.dto';
import { DeliveryType } from '@prisma/client';

const validateDto = (plain: Record<string, unknown>) =>
  validate(plainToInstance(SetServiceBookingConfigsDto, plain));

const validateConfig = (plain: Record<string, unknown>) =>
  validate(plainToInstance(BookingConfigInputDto, plain));

const validateDurationOption = (plain: Record<string, unknown>) =>
  validate(plainToInstance(BookingConfigDurationOptionInputDto, plain));

const validateWindow = (plain: Record<string, unknown>) =>
  validate(plainToInstance(ServiceAvailabilityWindowInputDto, plain));

const validConfig = {
  price: 5000,
  durationMins: 30,
};

describe('SetServiceBookingConfigsDto', () => {
  it('accepts a payload with one valid type', async () => {
    const errors = await validateDto({ types: [validConfig] });
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated type with duration options and windows', async () => {
    const errors = await validateDto({
      types: [
        {
          ...validConfig,
          deliveryType: DeliveryType.IN_PERSON,
          isActive: true,
          useCustomAvailability: false,
          durationOptions: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              label: '30 min',
              labelAr: '30 دقيقة',
              durationMins: 30,
              price: 5000,
              currency: 'SAR',
              isDefault: true,
              sortOrder: 0,
              isActive: true,
            },
          ],
          availabilityWindows: [
            { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isActive: true },
          ],
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing types array', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects an empty types array (at least one required)', async () => {
    const errors = await validateDto({ types: [] });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a non-array types field', async () => {
    const errors = await validateDto({ types: 'not-an-array' });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a negative price', async () => {
    const errors = await validateDto({
      types: [{ ...validConfig, price: -1 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a non-integer price', async () => {
    const errors = await validateDto({
      types: [{ ...validConfig, price: 99.99 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a duration < 1', async () => {
    const errors = await validateDto({
      types: [{ ...validConfig, durationMins: 0 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects an out-of-enum deliveryType', async () => {
    const errors = await validateDto({
      types: [{ ...validConfig, deliveryType: 'TELEPATHY' }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({
      types: [{ ...validConfig, isActive: 'true' }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a non-boolean useCustomAvailability', async () => {
    const errors = await validateDto({
      types: [{ ...validConfig, useCustomAvailability: 1 }],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a duration option with a label longer than 100 chars', async () => {
    const errors = await validateDto({
      types: [
        {
          ...validConfig,
          durationOptions: [{ label: 'A'.repeat(101), durationMins: 30, price: 5000 }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects a duration option with a non-UUID id', async () => {
    const errors = await validateDto({
      types: [
        {
          ...validConfig,
          durationOptions: [{ id: 'not-a-uuid', label: '30 min', durationMins: 30, price: 5000 }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects an availability window with dayOfWeek < 0', async () => {
    const errors = await validateDto({
      types: [
        {
          ...validConfig,
          availabilityWindows: [{ dayOfWeek: -1, startTime: '09:00', endTime: '17:00' }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });

  it('rejects an availability window with a 24:00 startTime', async () => {
    const errors = await validateDto({
      types: [
        {
          ...validConfig,
          availabilityWindows: [{ dayOfWeek: 1, startTime: '24:00', endTime: '25:00' }],
        },
      ],
    });
    expect(errors.some((e) => e.property === 'types')).toBe(true);
  });
});

describe('BookingConfigInputDto', () => {
  it('accepts a fully valid instance directly', async () => {
    const errors = await validateConfig(validConfig);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing price when validated directly', async () => {
    const { price: _ignored, ...rest } = validConfig;
    const errors = await validateConfig(rest);
    expect(errors.some((e) => e.property === 'price')).toBe(true);
  });

  it('rejects a missing durationMins when validated directly', async () => {
    const { durationMins: _ignored, ...rest } = validConfig;
    const errors = await validateConfig(rest);
    expect(errors.some((e) => e.property === 'durationMins')).toBe(true);
  });
});

describe('BookingConfigDurationOptionInputDto', () => {
  it('accepts a valid duration option directly', async () => {
    const errors = await validateDurationOption({ label: '30 min', durationMins: 30, price: 5000 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing label', async () => {
    const errors = await validateDurationOption({ durationMins: 30, price: 5000 });
    expect(errors.some((e) => e.property === 'label')).toBe(true);
  });
});

describe('ServiceAvailabilityWindowInputDto', () => {
  it('accepts a valid availability window directly', async () => {
    const errors = await validateWindow({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-HH:MM startTime', async () => {
    const errors = await validateWindow({ dayOfWeek: 1, startTime: '9am', endTime: '17:00' });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('rejects a dayOfWeek > 6', async () => {
    const errors = await validateWindow({ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' });
    expect(errors.some((e) => e.property === 'dayOfWeek')).toBe(true);
  });
});
