import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(RequestOtpDto, plain);
  return validate(dto);
}

describe('RequestOtpDto', () => {
  const valid: Record<string, unknown> = {
    channel: 'EMAIL',
    identifier: 'user@example.com',
    purpose: 'GUEST_BOOKING',
  };

  it('accepts a valid payload with email identifier', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid Saudi phone identifier (normalized)', async () => {
    const errors = await validateDto({
      ...valid,
      channel: 'SMS',
      identifier: '0501234567',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts SMS channel for phone identifiers', async () => {
    const errors = await validateDto({
      channel: 'SMS',
      identifier: '+966501234567',
      purpose: 'CLIENT_LOGIN',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown channel (not in OtpChannel enum)', async () => {
    const errors = await validateDto({ ...valid, channel: 'PIGEON' });
    expect(errors.some((e) => e.property === 'channel')).toBe(true);
  });

  it('rejects an unknown purpose (not in OtpPurpose enum)', async () => {
    const errors = await validateDto({ ...valid, purpose: 'NUKE_THE_SITE' });
    expect(errors.some((e) => e.property === 'purpose')).toBe(true);
  });

  it('rejects an empty identifier', async () => {
    const errors = await validateDto({ ...valid, identifier: '' });
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a non-string identifier', async () => {
    const errors = await validateDto({ ...valid, identifier: 12345 });
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a missing identifier', async () => {
    const { identifier, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'identifier')).toBe(true);
  });

  it('rejects a missing channel', async () => {
    const { channel, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'channel')).toBe(true);
  });

  it('rejects a missing purpose', async () => {
    const { purpose, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'purpose')).toBe(true);
  });
});
