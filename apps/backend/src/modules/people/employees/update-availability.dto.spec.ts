import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AvailabilityException,
  AvailabilityWindow,
  UpdateAvailabilityDto,
} from './update-availability.dto';

async function validateDto(plain: Record<string, unknown>, Cls = UpdateAvailabilityDto) {
  const dto = plainToInstance(Cls, plain);
  return validate(dto);
}

describe('UpdateAvailabilityDto', () => {
  it('accepts a valid payload with only windows', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payload with windows and exceptions', async () => {
    const errors = await validateDto({
      windows: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '13:00', endTime: '17:00', isActive: true },
      ],
      exceptions: [
        {
          startDate: '2026-05-01T09:00:00.000Z',
          endDate: '2026-05-07T09:00:00.000Z',
          reason: 'Annual vacation',
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing windows array', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'windows')).toBe(true);
  });

  it('rejects a non-array windows field', async () => {
    const errors = await validateDto({ windows: 'not-an-array' });
    expect(errors.some((e) => e.property === 'windows')).toBe(true);
  });

  it('rejects a window with dayOfWeek < 0', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: -1, startTime: '09:00', endTime: '17:00' }],
    });
    expect(errors.some((e) => e.property === 'windows')).toBe(true);
  });

  it('rejects a window with dayOfWeek > 6', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }],
    });
    expect(errors.some((e) => e.property === 'windows')).toBe(true);
  });

  it('accepts a window with HH:MM:SS startTime (extended format)', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '17:00:00' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a window with a non-time startTime', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 1, startTime: 'nine', endTime: '17:00' }],
    });
    expect(errors.some((e) => e.property === 'windows')).toBe(true);
  });

  it('rejects a non-boolean isActive on a window', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: 'yes' }],
    });
    expect(errors.some((e) => e.property === 'windows')).toBe(true);
  });

  it('rejects an exception with non-ISO startDate', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      exceptions: [{ startDate: 'yesterday', endDate: '2026-05-07T09:00:00.000Z' }],
    });
    expect(errors.some((e) => e.property === 'exceptions')).toBe(true);
  });

  it('rejects an exception with non-ISO endDate', async () => {
    const errors = await validateDto({
      windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      exceptions: [{ startDate: '2026-05-01T09:00:00.000Z', endDate: 'soon' }],
    });
    expect(errors.some((e) => e.property === 'exceptions')).toBe(true);
  });
});

describe('AvailabilityWindow', () => {
  it('accepts a fully valid instance with isActive flag', async () => {
    const errors = await validateDto(
      { dayOfWeek: 2, startTime: '08:00', endTime: '12:00', isActive: true },
      AvailabilityWindow,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects an AvailabilityWindow missing startTime', async () => {
    const errors = await validateDto({ dayOfWeek: 0, endTime: '10:00' }, AvailabilityWindow);
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });
});

describe('AvailabilityException', () => {
  it('accepts a fully valid instance', async () => {
    const errors = await validateDto(
      {
        startDate: '2026-05-01T09:00:00.000Z',
        endDate: '2026-05-07T09:00:00.000Z',
        reason: 'Annual vacation',
      },
      AvailabilityException,
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-ISO startDate on the exception itself', async () => {
    const errors = await validateDto(
      { startDate: 'yesterday', endDate: '2026-05-07T09:00:00.000Z' },
      AvailabilityException,
    );
    expect(errors.some((e) => e.property === 'startDate')).toBe(true);
  });
});
