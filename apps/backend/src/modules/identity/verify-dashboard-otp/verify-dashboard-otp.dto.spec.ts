import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyDashboardOtpDto } from './verify-dashboard-otp.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(VerifyDashboardOtpDto, plain);
  return validate(dto);
}

describe('VerifyDashboardOtpDto', () => {
  const valid: Record<string, unknown> = {
    identifier: 'admin@sawa.example',
    code: '123456',
  };

  it('accepts a valid 6-digit code', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a phone identifier with E.164 format', async () => {
    const errors = await validateDto({ ...valid, identifier: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a 5-digit code (too short)', async () => {
    const errors = await validateDto({ ...valid, code: '12345' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects a 7-digit code (too long)', async () => {
    const errors = await validateDto({ ...valid, code: '1234567' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects an empty code', async () => {
    const errors = await validateDto({ ...valid, code: '' });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects a missing code', async () => {
    const { code, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });

  it('rejects an empty identifier', async () => {
    const errors = await validateDto({ ...valid, identifier: '' });
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a missing identifier', async () => {
    const { identifier, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a non-string code', async () => {
    const errors = await validateDto({ ...valid, code: 123456 });
    expect(errors.some((e) => e.property === 'code')).toBe(true);
  });
});
