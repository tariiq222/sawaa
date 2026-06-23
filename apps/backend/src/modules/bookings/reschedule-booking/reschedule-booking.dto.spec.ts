import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RescheduleBookingDto } from './reschedule-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RescheduleBookingDto, plain);
  return validate(dto);
}

describe('RescheduleBookingDto', () => {
  const valid: Record<string, unknown> = {
    newScheduledAt: '2026-05-10T10:00:00.000Z',
  };

  it('accepts a valid payload with just newScheduledAt', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional newDurationMins at the lower bound (1)', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 1 });
    expect(errors).toHaveLength(0);
  });

  it('rejects newDurationMins = 0 (Min(1))', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 0 });
    expect(errors.some((e) => e.property === 'newDurationMins')).toBe(true);
  });

  it('rejects negative newDurationMins', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: -5 });
    expect(errors.some((e) => e.property === 'newDurationMins')).toBe(true);
  });

  it('rejects a non-integer newDurationMins', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 45.5 });
    expect(errors.some((e) => e.property === 'newDurationMins')).toBe(true);
  });

  it('rejects a non-date newScheduledAt', async () => {
    const errors = await validateDto({ newScheduledAt: 'not-a-date' });
    expect(errors.some((e) => e.property === 'newScheduledAt')).toBe(true);
  });

  it('rejects a missing newScheduledAt', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'newScheduledAt')).toBe(true);
  });

  it('rejects newScheduledAt that is a number, not a string', async () => {
    const errors = await validateDto({ newScheduledAt: 1234567890 });
    expect(errors.some((e) => e.property === 'newScheduledAt')).toBe(true);
  });
});
