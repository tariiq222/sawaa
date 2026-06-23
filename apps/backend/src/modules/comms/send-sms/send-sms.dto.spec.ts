import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendSmsDto } from './send-sms.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(SendSmsDto, plain);
  return validate(dto);
}

describe('SendSmsDto', () => {
  const valid: Record<string, unknown> = {
    phone: '+966501234567',
    body: 'Your booking is confirmed for tomorrow at 10 AM.',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a phone at the MinLength(5) boundary', async () => {
    const errors = await validateDto({ ...valid, phone: '+9665' });
    expect(errors.some((e) => e.property === 'phone')).toBe(false);
  });

  it('rejects a phone shorter than 5 chars', async () => {
    const errors = await validateDto({ ...valid, phone: '+966' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects a non-string phone', async () => {
    const errors = await validateDto({ ...valid, phone: 966501234 });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects a missing phone', async () => {
    const errors = await validateDto({ body: valid.body });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects an empty body', async () => {
    const errors = await validateDto({ ...valid, body: '' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a missing body', async () => {
    const errors = await validateDto({ phone: valid.phone });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a non-string body', async () => {
    const errors = await validateDto({ ...valid, body: { text: 'hi' } });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });
});
