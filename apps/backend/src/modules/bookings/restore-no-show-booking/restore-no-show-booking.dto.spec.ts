import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RestoreNoShowBookingDto } from './restore-no-show-booking.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RestoreNoShowBookingDto, plain);
  return validate(dto);
}

describe('RestoreNoShowBookingDto', () => {
  it('accepts a reason that meets the min/max length', async () => {
    const errors = await validateDto({ reason: 'Client arrived late; auto-no-show was wrong' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty payload (reason is required)', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('rejects a reason shorter than 3 characters', async () => {
    const errors = await validateDto({ reason: 'no' });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('accepts a reason of exactly 3 characters (boundary)', async () => {
    const errors = await validateDto({ reason: 'abc' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a reason longer than 500 characters', async () => {
    const errors = await validateDto({ reason: 'a'.repeat(501) });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });

  it('accepts a reason of exactly 500 characters (boundary)', async () => {
    const errors = await validateDto({ reason: 'a'.repeat(500) });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string reason', async () => {
    const errors = await validateDto({ reason: 12345 });
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
