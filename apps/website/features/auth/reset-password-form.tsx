'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { validatePassword } from './auth.schema';
import { clientResetPasswordApi } from './auth.api';
import { verifyOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

type Step = 'otp' | 'password';

interface ResetPasswordFormProps {
  initialEmail?: string;
  onSuccess?: () => void;
}

export function ResetPasswordForm({ initialEmail, onSuccess }: ResetPasswordFormProps) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = initialEmail ?? (searchParams?.get('email') ?? '');

  const [step, setStep] = useState<Step>('otp');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleOtpSubmit() {
    if (otpCode.length !== 6) {
      setError(t('auth.enterSixDigitCode'));
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const result = await verifyOtp(email, otpCode, OtpPurpose.CLIENT_PASSWORD_RESET);
      setOtpToken(result.sessionToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.invalidCode'));
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
      setError(t('auth.sessionExpired'));
      setStep('otp');
      return;
    }

    setIsLoading(true);
    try {
      await clientResetPasswordApi({ sessionToken: otpToken, newPassword });
      setSuccessMsg(t('auth.passwordUpdated'));
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetFailed'));
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
            {t('auth.codeSent')} {email}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="rp-otp" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {t('auth.verificationCode')}
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
          <button
            onClick={handleOtpSubmit}
            disabled={isLoading || otpCode.length !== 6}
            style={primaryButtonStyle(isLoading || otpCode.length !== 6)}
          >
            {isLoading ? t('auth.verifying') : t('auth.verify')}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.875rem', opacity: 0.8 }}>
            <a href="/forgot-password" style={{ color: 'var(--primary)' }}>
              {t('auth.requestNewCode')}
            </a>
          </p>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            {t('auth.emailVerifiedSetPassword')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="rp-password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {t('auth.newPassword')}
            </label>
            <input
              id="rp-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('auth.passwordHint')}
              autoComplete="new-password"
              required
              style={inputStyle()}
            />
          </div>
          <button type="submit" disabled={isLoading} style={primaryButtonStyle(isLoading)}>
            {isLoading ? t('auth.resetting') : t('auth.resetPassword')}
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
