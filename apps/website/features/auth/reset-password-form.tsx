'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { validatePassword } from './auth.schema';
import { clientResetPasswordApi } from './auth.api';
import { verifyOtp } from '@/features/otp/otp.api';
import { OtpPurpose } from '@sawaa/shared';
import { KeyRound, Lock, CheckCircle2 } from 'lucide-react';

type Step = 'otp' | 'password';

interface ResetPasswordFormProps {
  initialEmail?: string;
  onSuccess?: () => void;
}

const INPUT =
  'w-full py-3 ps-[2.625rem] pe-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none box-border transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';
const ICON =
  'absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--sw-neutral-400)] flex items-center pointer-events-none';
const LABEL = 'text-sm font-medium text-[var(--sw-secondary-700)]';
const PRIMARY_BTN =
  'mt-1 px-6 py-3.5 rounded-full bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] font-extrabold text-base border-0 cursor-pointer shadow-[var(--sw-shadow-primary)] w-full transition-[transform,box-shadow,background] duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0';

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
    } catch {
      setError(t('auth.invalidCode'));
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
    } catch {
      setError(t('auth.resetFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-[1.125rem]">
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm leading-normal bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]"
          role="alert"
        >
          {error}
        </div>
      )}
      {successMsg && (
        <div
          className="px-4 py-3 rounded-xl text-sm leading-normal bg-[color-mix(in_srgb,var(--success)_10%,transparent)] border border-[color-mix(in_srgb,var(--success)_25%,transparent)] text-[var(--success)] flex items-center gap-2"
          role="status"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {step === 'otp' && (
        <div className="flex flex-col gap-[1.125rem]">
          <p className="text-sm text-[var(--sw-body)] leading-relaxed">
            {t('auth.codeSent')}{' '}
            <span className="font-semibold text-[var(--sw-secondary-700)]">{email}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rp-otp" className={LABEL}>
              {t('auth.verificationCode')}
            </label>
            <div className="relative">
              <span className={ICON} aria-hidden="true">
                <KeyRound size={16} />
              </span>
              <input
                id="rp-otp"
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                placeholder="000000"
                className={`${INPUT} text-2xl tracking-[0.5em] text-center font-semibold`}
              />
            </div>
          </div>
          <button
            onClick={handleOtpSubmit}
            disabled={isLoading || otpCode.length !== 6}
            className={PRIMARY_BTN}
          >
            {isLoading ? t('auth.verifying') : t('auth.verify')}
          </button>
          <p className="text-center text-sm text-[var(--sw-body)]">
            <a
              href="/forgot-password"
              className="text-[var(--sw-primary-600)] font-semibold hover:underline"
            >
              {t('auth.requestNewCode')}
            </a>
          </p>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-[1.125rem]">
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-[color-mix(in_srgb,var(--success)_22%,transparent)]">
            <span className="mt-0.5 text-[var(--success)]" aria-hidden="true">
              <CheckCircle2 size={14} />
            </span>
            <p className="text-sm text-[var(--sw-secondary-700)] leading-relaxed">
              {t('auth.emailVerifiedSetPassword')}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rp-password" className={LABEL}>
              {t('auth.newPassword')}
            </label>
            <div className="relative">
              <span className={ICON} aria-hidden="true">
                <Lock size={16} />
              </span>
              <input
                id="rp-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('auth.passwordHint')}
                autoComplete="new-password"
                required
                className={INPUT}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--sw-neutral-500)] -mt-2">{t('auth.passwordHint')}</p>
          <button type="submit" disabled={isLoading} className={PRIMARY_BTN}>
            {isLoading ? t('auth.resetting') : t('auth.resetPassword')}
          </button>
        </form>
      )}
    </div>
  );
}
