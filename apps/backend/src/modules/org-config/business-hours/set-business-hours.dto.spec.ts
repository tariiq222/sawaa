import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BusinessHourSlotDto,
  SetBusinessHoursDto,
} from './set-business-hours.dto';

async function validateSlot(plain: Record<string, unknown>) {
  const dto = plainToInstance(BusinessHourSlotDto, plain);
  return validate(dto);
}

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SetBusinessHoursDto, plain);
  return validate(dto);
}

describe('BusinessHourSlotDto', () => {
  const valid = { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOpen: true };

  it('accepts a valid slot', async () => {
    const errors = await validateSlot(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts dayOfWeek = 0 (Sunday)', async () => {
    const errors = await validateSlot({ ...valid, dayOfWeek: 0 });
    expect(errors).toHaveLength(0);
  });

  it('accepts dayOfWeek = 6 (Saturday)', async () => {
    const errors = await validateSlot({ ...valid, dayOfWeek: 6 });
    expect(errors).toHaveLength(0);
  });

  it('rejects dayOfWeek = 7 (above max)', async () => {
    const errors = await validateSlot({ ...valid, dayOfWeek: 7 });
    expect(errors.some((e) => e.property === 'dayOfWeek')).toBe(true);
  });

  it('rejects dayOfWeek = -1 (below min)', async () => {
    const errors = await validateSlot({ ...valid, dayOfWeek: -1 });
    expect(errors.some((e) => e.property === 'dayOfWeek')).toBe(true);
  });

  it('rejects a non-integer dayOfWeek', async () => {
    const errors = await validateSlot({ ...valid, dayOfWeek: 1.5 });
    expect(errors.some((e) => e.property === 'dayOfWeek')).toBe(true);
  });

  it('rejects a startTime not matching HH:mm', async () => {
    const errors = await validateSlot({ ...valid, startTime: '9am' });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('rejects a startTime with seconds', async () => {
    const errors = await validateSlot({ ...valid, startTime: '09:00:00' });
    expect(errors.some((e) => e.property === 'startTime')).toBe(true);
  });

  it('accepts the startTime boundary 00:00', async () => {
    const errors = await validateSlot({ ...valid, startTime: '00:00' });
    expect(errors).toHaveLength(0);
  });

  it('accepts the endTime boundary 23:59', async () => {
    const errors = await validateSlot({ ...valid, endTime: '23:59' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an endTime with hour 24 (above 23)', async () => {
    const errors = await validateSlot({ ...valid, endTime: '24:00' });
    expect(errors.some((e) => e.property === 'endTime')).toBe(true);
  });

  it('rejects a non-boolean isOpen', async () => {
    const errors = await validateSlot({ ...valid, isOpen: 'true' });
    expect(errors.some((e) => e.property === 'isOpen')).toBe(true);
  });
});

describe('SetBusinessHoursDto', () => {
  const valid = {
    branchId: 'main-branch',
    schedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOpen: true }],
  };

  it('accepts a valid payload with one schedule entry', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a 7-entry weekly schedule (upper bound)', async () => {
    const schedule = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00',
      isOpen: true,
    }));
    const errors = await validateDto({ ...valid, schedule });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty schedule (@ArrayMinSize(1))', async () => {
    const errors = await validateDto({ ...valid, schedule: [] });
    expect(errors.some((e) => e.property === 'schedule')).toBe(true);
  });

  it('rejects a 8-entry schedule (above ArrayMaxSize(7))', async () => {
    const schedule = Array.from({ length: 8 }, (_, i) => ({
      dayOfWeek: i,
      startTime: '09:00',
      endTime: '17:00',
      isOpen: true,
    }));
    const errors = await validateDto({ ...valid, schedule });
    expect(errors.some((e) => e.property === 'schedule')).toBe(true);
  });

  it('rejects a missing branchId', async () => {
    const { branchId, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a non-string branchId', async () => {
    const errors = await validateDto({ ...valid, branchId: 42 });
    expect(errors.some((e) => e.property === 'branchId')).toBe(true);
  });

  it('rejects a schedule entry with an invalid nested time format', async () => {
    const errors = await validateDto({
      ...valid,
      schedule: [{ dayOfWeek: 1, startTime: '9am', endTime: '5pm', isOpen: true }],
    });
    expect(errors.some((e) => e.property === 'schedule')).toBe(true);
  });

  it('rejects a non-array schedule', async () => {
    const errors = await validateDto({ ...valid, schedule: 'not-an-array' });
    expect(errors.some((e) => e.property === 'schedule')).toBe(true);
  });
});
