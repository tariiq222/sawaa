import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestMobileLoginOtpDto } from './request-mobile-login-otp.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RequestMobileLoginOtpDto, plain);
  return validate(dto);
}

describe('RequestMobileLoginOtpDto', () => {
  it('accepts a valid Saudi phone (local format, normalized)', async () => {
    const dto = plainToInstance(RequestMobileLoginOtpDto, { identifier: '0501234567' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.identifier).toBe('+966501234567');
  });

  it('accepts an E.164 phone', async () => {
    const errors = await validateDto({ identifier: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('accepts an email identifier', async () => {
    const errors = await validateDto({ identifier: 'user@example.com' });
    expect(errors).toHaveLength(0);
  });

  it('trims and lowercases an email identifier', async () => {
    const dto = plainToInstance(RequestMobileLoginOtpDto, {
      identifier: '  User@Example.COM  ',
    });
    await validate(dto);
    expect(dto.identifier).toBe('user@example.com');
  });

  it('rejects a missing identifier', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a non-string identifier', async () => {
    const errors = await validateDto({ identifier: 42 });
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects an unparseable phone-shaped string', () => {
    expect(() =>
      plainToInstance(RequestMobileLoginOtpDto, { identifier: 'abc-defg' }),
    ).toThrow();
  });
});
