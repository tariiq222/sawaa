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

  it('does not expose newDurationMins and strips a forged value under the API whitelist', async () => {
    const dto = plainToInstance(ClientRescheduleBookingDto, { ...valid, newDurationMins: 90 });
    const errors = await validate(dto, { whitelist: true });

    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('newDurationMins');
  });
});
