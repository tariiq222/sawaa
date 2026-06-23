import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CancellationReason } from '@prisma/client';
import { CancelBookingDto } from './cancel-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CancelBookingDto, plain);
  return validate(dto);
}

describe('CancelBookingDto', () => {
  const valid: Record<string, unknown> = {
    reason: CancellationReason.CLIENT_REQUESTED,
  };

  it('accepts a valid payload with just reason', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts every CancellationReason enum value', async () => {
    for (const reason of Object.values(CancellationReason)) {
      const errors = await validateDto({ reason });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown reason value', async () => {
    const errors = await validateDto({ reason: 'NOT_A_REASON' });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a missing reason', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('accepts an optional cancelNotes string', async () => {
    const errors = await validateDto({ ...valid, cancelNotes: 'Client called to cancel' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string cancelNotes', async () => {
    const errors = await validateDto({ ...valid, cancelNotes: 12345 });
    expect(errors.some((e) => e.property === 'cancelNotes')).toBe(true);
  });

  it('accepts every source value: client, admin, employee, system', async () => {
    for (const source of ['client', 'admin', 'employee', 'system'] as const) {
      const errors = await validateDto({ ...valid, source });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an unknown source value', async () => {
    const errors = await validateDto({ ...valid, source: 'intruder' });
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });
});
