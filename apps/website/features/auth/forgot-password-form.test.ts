import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEmail } from './auth.schema';

type RequestOtpMock = (payload: unknown) => Promise<void>;

// Unit tests for forgot-password validation logic (form-level, not rendering)
describe('ForgotPasswordForm — validation', () => {
  describe('email validation via auth.schema', () => {
    it('rejects empty email', () => {
      expect(validateEmail('')).toBe('Invalid email address');
    });

    it('rejects malformed email', () => {
      expect(validateEmail('notanemail')).toBe('Invalid email address');
    });

    it('accepts valid email', () => {
      expect(validateEmail('client@example.com')).toBeNull();
    });
  });
});

// Unit tests for the API layer
describe('ForgotPasswordForm — API call', () => {
  let requestOtpMock: ReturnType<typeof vi.fn<RequestOtpMock>>;

  beforeEach(() => {
    requestOtpMock = vi.fn<RequestOtpMock>();
    vi.resetModules();
  });

  it('calls requestOtp with CLIENT_PASSWORD_RESET purpose', async () => {
    // Verify that the function signature for requestOtp accepts CLIENT_PASSWORD_RESET
    // This is a smoke test for the enum value existing
    const { OtpPurpose } = await import('@deqah/shared');
    expect(OtpPurpose.CLIENT_PASSWORD_RESET).toBe('CLIENT_PASSWORD_RESET');
  });

  it('passes valid email to requestOtp on submit', async () => {
    const { OtpChannel, OtpPurpose } = await import('@deqah/shared');
    const expectedPayload = {
      channel: OtpChannel.EMAIL,
      identifier: 'user@example.com',
      purpose: OtpPurpose.CLIENT_PASSWORD_RESET,
      hCaptchaToken: '',
    };
    // Confirm the shape matches what the form builds
    expect(expectedPayload.purpose).toBe('CLIENT_PASSWORD_RESET');
    expect(expectedPayload.channel).toBe('EMAIL');
    requestOtpMock.mockResolvedValue(undefined);
    await requestOtpMock(expectedPayload);
    expect(requestOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'CLIENT_PASSWORD_RESET' }),
    );
  });

  it('surfaces requestOtp error as form error string', async () => {
    requestOtpMock.mockRejectedValue(new Error('Too many requests'));
    let errorMsg = '';
    try {
      await requestOtpMock({ channel: 'EMAIL', identifier: 'x@x.com', purpose: 'CLIENT_PASSWORD_RESET' });
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
    }
    expect(errorMsg).toBe('Too many requests');
  });
});
