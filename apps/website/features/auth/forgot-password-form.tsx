'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { validateEmail } from './auth.schema';
import { requestOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';
import { Mail } from 'lucide-react';

interface ForgotPasswordFormProps {
  onSuccess?: (email: string) => void;
}

const INPUT =
  'w-full py-3 ps-[2.625rem] pe-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none box-border transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';
const ICON =
  'absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--sw-neutral-400)] flex items-center pointer-events-none';
const LABEL = 'text-sm font-medium text-[var(--sw-secondary-700)]';
const PRIMARY_BTN =
  'mt-1 px-6 py-3.5 rounded-full bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] font-extrabold text-base border-0 cursor-pointer shadow-[var(--sw-shadow-primary)] w-full transition-[transform,box-shadow,background] duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0';

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setIsLoading(true);
    try {
      await requestOtp({
        channel: OtpChannel.EMAIL,
        identifier: email,
        purpose: OtpPurpose.CLIENT_PASSWORD_RESET,
      });
      if (onSuccess) {
        onSuccess(email);
      } else {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }
    } catch {
      setError(t('auth.failedToSendCode'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[1.125rem]">
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm leading-normal bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]"
          role="alert"
        >
          {error}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fp-email" className={LABEL}>
          {t('auth.email')}
        </label>
        <div className="relative">
          <span className={ICON} aria-hidden="true">
            <Mail size={16} />
          </span>
          <input
            id="fp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            autoComplete="email"
            required
            className={INPUT}
          />
        </div>
      </div>
      <button type="submit" disabled={isLoading} className={PRIMARY_BTN}>
        {isLoading ? t('auth.sending') : t('auth.sendCode')}
      </button>
      <p className="text-center text-sm text-[var(--sw-body)]">
        <a href="/login" className="text-[var(--sw-primary-600)] font-semibold hover:underline">
          {t('auth.backToLogin')}
        </a>
      </p>
    </form>
  );
}
