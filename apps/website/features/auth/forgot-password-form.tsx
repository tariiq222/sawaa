'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import type { MessageKey } from '@/features/locale/dictionary';
import { validateEmail, normalizeSaudiPhone } from './auth.schema';
import { requestOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';
import { User } from 'lucide-react';

interface ForgotPasswordFormProps {
  /** Called with the identifier the OTP was sent to (email or E.164 phone). */
  onSuccess?: (identifier: string) => void;
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
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Email (contains '@') gets the code by email; otherwise treat the
    // input as a Saudi phone and send the code by SMS.
    const trimmed = identifier.trim();
    let channel: OtpChannel;
    let normalized: string;
    if (trimmed.includes('@')) {
      const emailError = validateEmail(trimmed);
      if (emailError) {
        setError(t(emailError as MessageKey));
        return;
      }
      channel = OtpChannel.EMAIL;
      normalized = trimmed;
    } else {
      const normalizedPhone = normalizeSaudiPhone(trimmed);
      if (!normalizedPhone) {
        setError(t('auth.invalidPhone'));
        return;
      }
      channel = OtpChannel.SMS;
      normalized = normalizedPhone;
    }
    setIsLoading(true);
    try {
      await requestOtp({
        channel,
        identifier: normalized,
        purpose: OtpPurpose.CLIENT_PASSWORD_RESET,
      });
      if (onSuccess) {
        onSuccess(normalized);
      } else {
        router.push(`/reset-password?identifier=${encodeURIComponent(normalized)}`);
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
        <label htmlFor="fp-identifier" className={LABEL}>
          {t('auth.emailOrPhone')}
        </label>
        <div className="relative">
          <span className={ICON} aria-hidden="true">
            <User size={16} />
          </span>
          <input
            id="fp-identifier"
            type="text"
            dir="ltr"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="05XXXXXXXX"
            autoComplete="username"
            required
            className={`${INPUT} text-start`}
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
