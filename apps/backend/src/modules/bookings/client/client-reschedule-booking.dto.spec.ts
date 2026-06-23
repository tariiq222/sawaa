import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientRescheduleBookingDto } from './client-reschedule-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ClientRescheduleBookingDto, plain, { enableImplicitConversion: true });
  return validate(dto);
}

describe('ClientRescheduleBookingDto', () => {
  const valid: Record<string, unknown> = {
    newScheduledAt: '2026-05-10T10:00:00.000Z',
  };

  it('accepts a valid payload with just newScheduledAt', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty newScheduledAt (IsNotEmpty)', async () => {
    const errors = await validateDto({ newScheduledAt: '' });
    expect(errors.some((e) => e.property === 'newScheduledAt')).toBe(true);
  });

  it('rejects a non-date newScheduledAt', async () => {
    const errors = await validateDto({ newScheduledAt: 'not-a-date' });
    expect(errors.some((e) => e.property === 'newScheduledAt')).toBe(true);
  });

  it('rejects a missing newScheduledAt', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'newScheduledAt')).toBe(true);
  });

  it('accepts newDurationMins at the lower bound (15)', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 15 });
    expect(errors).toHaveLength(0);
  });

  it('rejects newDurationMins = 14 (Min(15))', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 14 });
    expect(errors.some((e) => e.property === 'newDurationMins')).toBe(true);
  });

  it('rejects newDurationMins = 0', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 0 });
    expect(errors.some((e) => e.property === 'newDurationMins')).toBe(true);
  });

  it('rejects a non-integer newDurationMins', async () => {
    const errors = await validateDto({ ...valid, newDurationMins: 30.5 });
    expect(errors.some((e) => e.property === 'newDurationMins')).toBe(true);
  });
});
