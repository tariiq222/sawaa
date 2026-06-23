import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientCancelBookingDto } from './client-cancel-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(ClientCancelBookingDto, plain);
  return validate(dto);
}

describe('ClientCancelBookingDto', () => {
  it('accepts an empty payload (reason is optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a reason string', async () => {
    const errors = await validateDto({ reason: 'Schedule conflict' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string reason', async () => {
    const errors = await validateDto({ reason: 42 });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a boolean reason', async () => {
    const errors = await validateDto({ reason: true });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
