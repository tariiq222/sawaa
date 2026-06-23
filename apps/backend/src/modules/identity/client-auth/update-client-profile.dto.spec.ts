import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateClientProfileDto } from './update-client-profile.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateClientProfileDto, plain);
  return validate(dto);
}

describe('UpdateClientProfileDto', () => {
  it('accepts an empty payload (all fields are optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid name (trims whitespace, length 2-120)', async () => {
    const errors = await validateDto({ name: 'أحمد محمد العتيبي' });
    expect(errors).toHaveLength(0);
  });

  it('trims surrounding whitespace on the name field', async () => {
    const dto = plainToInstance(UpdateClientProfileDto, { name: '  Sara  ' });
    await validate(dto);
    expect(dto.name).toBe('Sara');
  });

  it('rejects a name shorter than 2 chars', async () => {
    const errors = await validateDto({ name: 'أ' });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name longer than 120 chars', async () => {
    const tooLong = 'أ'.repeat(121);
    const errors = await validateDto({ name: tooLong });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('accepts a valid Saudi phone in local format (normalized to E.164)', async () => {
    const errors = await validateDto({ phone: '0501234567' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid Saudi phone in E.164 format', async () => {
    const errors = await validateDto({ phone: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-Saudi phone number (libphonenumber parses, regex rejects)', async () => {
    const errors = await validateDto({ phone: '+12025550123' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects a phone with the wrong Saudi prefix (+9666…)', () => {
    // libphonenumber-js does not accept +9666… as a valid number, so the
    // @NormalizePhone transform throws BadRequestException before validation.
    expect(() =>
      plainToInstance(UpdateClientProfileDto, { phone: '+966601234567' }),
    ).toThrow();
  });

  it('rejects a phone that is not a phone-shaped string', () => {
    // @NormalizePhone throws BadRequestException before validation runs.
    expect(() =>
      plainToInstance(UpdateClientProfileDto, { phone: 'not-a-phone' }),
    ).toThrow();
  });

  it('accepts a valid email (trimmed and lowercased)', async () => {
    const dto = plainToInstance(UpdateClientProfileDto, {
      email: '  Client@Example.COM  ',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('client@example.com');
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a non-string name (numeric)', async () => {
    const errors = await validateDto({ name: 12345 });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });
});
