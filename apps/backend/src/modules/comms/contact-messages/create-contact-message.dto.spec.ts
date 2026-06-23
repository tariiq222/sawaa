import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContactMessageDto } from './create-contact-message.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateContactMessageDto, plain);
  return validate(dto);
}

describe('CreateContactMessageDto', () => {
  const valid: Record<string, unknown> = {
    name: 'سارة أحمد',
    body: 'أرغب بمعرفة أوقات الدوام',
  };

  it('accepts a valid payload (name + body only)', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid payload with phone and email', async () => {
    const errors = await validateDto({
      ...valid,
      phone: '+966501234567',
      email: 'sara@example.com',
      subject: 'استفسار عن الحجز',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts phone omitted when email provided', async () => {
    const errors = await validateDto({ ...valid, email: 'sara@example.com' });
    expect(errors).toHaveLength(0);
  });

  it('accepts email omitted when phone provided', async () => {
    const errors = await validateDto({ ...valid, phone: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a name shorter than 2 chars', async () => {
    const errors = await validateDto({ ...valid, name: 'س' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name longer than 200 chars', async () => {
    const errors = await validateDto({ ...valid, name: 'ا'.repeat(201) });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a missing name', async () => {
    const errors = await validateDto({ body: valid.body });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a missing body', async () => {
    const errors = await validateDto({ name: valid.name });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a body shorter than 5 chars', async () => {
    const errors = await validateDto({ ...valid, body: 'hi' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a body longer than 5000 chars', async () => {
    const errors = await validateDto({ ...valid, body: 'ا'.repeat(5001) });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('rejects a phone that does not match the E.164-ish pattern', async () => {
    const errors = await validateDto({ ...valid, phone: 'abc-not-phone' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects a non-email email field', async () => {
    const errors = await validateDto({ ...valid, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a subject longer than 200 chars', async () => {
    const errors = await validateDto({ ...valid, subject: 'ا'.repeat(201) });
    expect(errors.some((e) => e.property === 'subject')).toBe(true);
  });
});
