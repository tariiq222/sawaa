'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validatePassword } from './auth.schema';
import { clientResetPasswordApi } from './auth.api';
import { verifyOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@deqah/shared';
import { CaptchaField } from '@/features/otp/captcha-field';

type Step = 'otp' | 'password';

interface ResetPasswordFormProps {
  initialEmail?: string;
  onSuccess?: () => void;
}

export function ResetPasswordForm({ initialEmail, onSuccess }: ResetPasswordFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = initialEmail ?? (searchParams?.get('email') ?? '');

  const [step, setStep] = useState<Step>('otp');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleOtpSubmit() {
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    if (!captchaToken) {
      setError('Please complete the captcha');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await verifyOtp(email, otpCode, OtpPurpose.CLIENT_PASSWORD_RESET, captchaToken);
      setOtpToken(result.sessionToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const pwError = validatePassword(newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (!otpToken) {
      setError('Session expired. Please request a new code.');
      setStep('otp');
      return;
    }

    setIsLoading(true);
    try {
      await clientResetPasswordApi({ sessionToken: otpToken, newPassword, hCaptchaToken: captchaToken ?? 'dev-bypass' });
      setSuccessMsg('Password updated successfully.');
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div style={{
          padding: '0.75rem',
          background: 'color-mix(in srgb, var(--error) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
          borderRadius: '8px',
          color: 'var(--error)',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '0.75rem',
          background: 'color-mix(in srgb, var(--success, #22c55e) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--success, #22c55e) 30%, transparent)',
          borderRadius: '8px',
          color: 'var(--success, #16a34a)',
          fontSize: '0.875rem',
        }}>
          {successMsg}
        </div>
      )}

      {step === 'otp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            We sent a verification code to {email}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="rp-otp" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              Verification Code
            </label>
            <input
              id="rp-otp"
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              style={{ ...inputStyle(), fontSize: '1.5rem', letterSpacing: '0.5em', textAlign: 'center' }}
            />
          </div>
          <CaptchaField
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
          />
          <button
            onClick={handleOtpSubmit}
            disabled={isLoading || otpCode.length !== 6 || !captchaToken}
            style={primaryButtonStyle(isLoading || otpCode.length !== 6 || !captchaToken)}
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.875rem', opacity: 0.8 }}>
            <a href="/forgot-password" style={{ color: 'var(--primary)' }}>
              Request a new code
            </a>
          </p>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            Email verified. Set your new password.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="rp-password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              New Password
            </label>
            <input
              id="rp-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 chars, 1 upper, 1 digit"
              autoComplete="new-password"
              required
              style={inputStyle()}
            />
          </div>
          <button type="submit" disabled={isLoading} style={primaryButtonStyle(isLoading)}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
    background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
    fontSize: '1rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.875rem',
    borderRadius: '8px',
    background: disabled ? 'var(--muted)' : 'var(--primary)',
    color: disabled ? 'var(--muted-foreground)' : 'var(--on-primary)',
    fontWeight: 600,
    fontSize: '1rem',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    transition: 'opacity 0.2s',
    width: '100%',
  };
}
