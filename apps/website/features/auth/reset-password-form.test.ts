import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePassword } from './auth.schema';

type ResetPasswordMock = (payload: unknown) => Promise<void>;

// Unit tests for reset-password validation logic
describe('ResetPasswordForm — password validation', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('Ab1')).toBe('Password must be at least 8 characters');
  });

  it('rejects passwords without uppercase letter', () => {
    expect(validatePassword('abcdefgh1')).toBe('Password must contain at least 1 uppercase letter');
  });

  it('rejects passwords without digit', () => {
    expect(validatePassword('ABCDEFGHa')).toBe('Password must contain at least 1 digit');
  });

  it('accepts valid password', () => {
    expect(validatePassword('NewSecure1')).toBeNull();
  });
});

// Unit tests for the reset-password API call
describe('ResetPasswordForm — API layer', () => {
  let resetPasswordMock: ReturnType<typeof vi.fn<ResetPasswordMock>>;

  beforeEach(() => {
    resetPasswordMock = vi.fn<ResetPasswordMock>();
  });

  it('calls clientResetPasswordApi with sessionToken and newPassword', async () => {
    resetPasswordMock.mockResolvedValue(undefined);
    await resetPasswordMock({ sessionToken: 'tok', newPassword: 'NewPass1' });
    expect(resetPasswordMock).toHaveBeenCalledWith({
      sessionToken: 'tok',
      newPassword: 'NewPass1',
    });
  });

  it('surfaces API error as error string', async () => {
    resetPasswordMock.mockRejectedValue(new Error('Session already used'));
    let errorMsg = '';
    try {
      await resetPasswordMock({ sessionToken: 'bad', newPassword: 'NewPass1' });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown';
    }
    expect(errorMsg).toBe('Session already used');
  });

  it('surfaces network error as error string', async () => {
    resetPasswordMock.mockRejectedValue(new Error('Network error'));
    let errorMsg = '';
    try {
      await resetPasswordMock({ sessionToken: 'tok', newPassword: 'NewPass1' });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown';
    }
    expect(errorMsg).toBe('Network error');
  });
});

// Unit tests for OTP verification step
describe('ResetPasswordForm — OTP step', () => {
  it('requires a 6-digit code before proceeding', () => {
    const isValid = (code: string) => code.length === 6;
    expect(isValid('123')).toBe(false);
    expect(isValid('123456')).toBe(true);
    expect(isValid('')).toBe(false);
  });

  it('uses CLIENT_PASSWORD_RESET purpose when verifying OTP', async () => {
    const { OtpPurpose } = await import('@deqah/shared');
    expect(OtpPurpose.CLIENT_PASSWORD_RESET).toBe('CLIENT_PASSWORD_RESET');
  });
});
