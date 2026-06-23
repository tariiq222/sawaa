import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterMobileUserDto } from './register-mobile-user.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RegisterMobileUserDto, plain);
  return validate(dto);
}

describe('RegisterMobileUserDto', () => {
  const valid: Record<string, unknown> = {
    firstName: 'سارة',
    lastName: 'الأحمد',
    phone: '0501234567', // normalized to +966501234567
    email: 'sara@example.com',
  };

  it('accepts a valid payload (local phone normalized)', async () => {
    const dto = plainToInstance(RegisterMobileUserDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+966501234567');
  });

  it('accepts an E.164 phone', async () => {
    const errors = await validateDto({ ...valid, phone: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty firstName', async () => {
    const errors = await validateDto({ ...valid, firstName: '' });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects an empty lastName', async () => {
    const errors = await validateDto({ ...valid, lastName: '' });
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
  });

  it('rejects a firstName longer than 60 chars', async () => {
    const tooLong = 'أ'.repeat(61);
    const errors = await validateDto({ ...valid, firstName: tooLong });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects a lastName longer than 60 chars', async () => {
    const tooLong = 'أ'.repeat(61);
    const errors = await validateDto({ ...valid, lastName: tooLong });
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ ...valid, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a non-phone-shaped string', () => {
    expect(() => plainToInstance(RegisterMobileUserDto, { ...valid, phone: 'abc' })).toThrow();
  });

  it('rejects a missing firstName', async () => {
    const { firstName, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const { email, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});
