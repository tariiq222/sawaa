import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MobileOtpPurposeDto, VerifyMobileOtpDto } from './verify-mobile-otp.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(VerifyMobileOtpDto, plain);
  return validate(dto);
}

describe('VerifyMobileOtpDto', () => {
  const valid: Record<string, unknown> = {
    identifier: '0501234567',
    code: '1234',
    purpose: MobileOtpPurposeDto.REGISTER,
  };

  it('accepts a valid 4-digit code with phone identifier', async () => {
    const dto = plainToInstance(VerifyMobileOtpDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.identifier).toBe('+966501234567');
  });

  it('accepts a valid email identifier', async () => {
    const errors = await validateDto({
      identifier: 'user@example.com',
      code: '0000',
      purpose: MobileOtpPurposeDto.LOGIN,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts both enum purposes (REGISTER, LOGIN)', async () => {
    for (const purpose of [MobileOtpPurposeDto.REGISTER, MobileOtpPurposeDto.LOGIN]) {
      const errors = await validateDto({ ...valid, purpose });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a 3-digit code (too short)', async () => {
    const errors = await validateDto({ ...valid, code: '123' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects a 5-digit code (too long)', async () => {
    const errors = await validateDto({ ...valid, code: '12345' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('accepts a 4-character alphanumeric code (length-only constraint, handler enforces digit format)', async () => {
    const errors = await validateDto({ ...valid, code: 'abcd' });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown purpose enum value', async () => {
    const errors = await validateDto({ ...valid, purpose: 'NUKE' });
    expect(errors.some((e) => e.property === 'purpose')).toBe(true);
  });

  it('rejects a missing purpose', async () => {
    const { purpose, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'purpose')).toBe(true);
  });

  it('rejects a missing code', async () => {
    const { code, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('accepts an email identifier of exactly 3 chars (boundary)', async () => {
    // 'a@b' is the smallest legal email — exercises the @MinLength(3) boundary.
    const errors = await validateDto({ ...valid, identifier: 'a@b' });
    expect(errors).toHaveLength(0);
  });
});
