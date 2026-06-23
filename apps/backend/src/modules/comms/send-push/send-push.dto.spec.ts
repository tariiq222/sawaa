import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendPushDto } from './send-push.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SendPushDto, plain);
  return validate(dto);
}

describe('SendPushDto', () => {
  const valid: Record<string, unknown> = {
    token: 'fXm3-token-abc',
    title: 'Booking Confirmed',
    body: 'Your appointment is tomorrow at 10 AM.',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts an optional data payload', async () => {
    const errors = await validateDto({
      ...valid,
      data: { bookingId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts data omitted (optional)', async () => {
    const errors = await validateDto(valid);
    expect(errors.some((e) => e.property === 'data')).toBe(false);
  });

  it('rejects a missing token', async () => {
    const errors = await validateDto({ title: valid.title, body: valid.body });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects an empty token', async () => {
    const errors = await validateDto({ ...valid, token: '' });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a non-string token', async () => {
    const errors = await validateDto({ ...valid, token: 12345 });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects an empty title', async () => {
    const errors = await validateDto({ ...valid, title: '' });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejects an empty body', async () => {
    const errors = await validateDto({ ...valid, body: '' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a non-object data field', async () => {
    const errors = await validateDto({ ...valid, data: 'not-an-object' });
    expect(errors.some((e) => e.property === 'data')).toBe(true);
  });
});
