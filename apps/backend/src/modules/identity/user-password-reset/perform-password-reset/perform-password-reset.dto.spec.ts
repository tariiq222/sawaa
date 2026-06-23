import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PerformPasswordResetDto } from './perform-password-reset.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(PerformPasswordResetDto, plain);
  return validate(dto);
}

describe('PerformPasswordResetDto', () => {
  const valid: Record<string, unknown> = {
    token: 'reset-token-from-email-link',
    newPassword: 'NewSecurePass1',
  };

  it('accepts a valid payload', async () => {
    const errors = await validateDto(valid);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty token', async () => {
    const errors = await validateDto({ ...valid, token: '' });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a missing token', async () => {
    const { token, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a non-string token', async () => {
    const errors = await validateDto({ ...valid, token: 12345 });
    expect(errors.some((e) => e.property === 'token')).toBe(true);
  });

  it('rejects a password shorter than 8 chars', async () => {
    const errors = await validateDto({ ...valid, newPassword: 'short1A' });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('rejects a password with no uppercase letter', async () => {
    const errors = await validateDto({ ...valid, newPassword: 'alllower123' });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('rejects a password with no digit', async () => {
    const errors = await validateDto({ ...valid, newPassword: 'NoDigitsHere' });
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('rejects a missing newPassword', async () => {
    const { newPassword, ...rest } = valid;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('accepts the 8-char lower bound with both required character classes', async () => {
    const errors = await validateDto({ ...valid, newPassword: 'Aa1bcdef' });
    expect(errors).toHaveLength(0);
  });
});
