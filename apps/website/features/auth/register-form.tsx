'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import type { MessageKey } from '@/features/locale/dictionary';
import { validatePassword, normalizeSaudiPhone } from './auth.schema';
import { clientRegisterApi, getMeApi } from './auth.api';
import { setClient } from './auth-store';
import { requestOtp, verifyOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';
import { User, Phone, KeyRound, Lock, ArrowRight } from 'lucide-react';

type Step = 'credentials' | 'otp' | 'password';

interface RegisterFormProps {
  onSuccess?: () => void;
}

const INPUT =
  'w-full py-3 ps-[2.625rem] pe-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none box-border transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';

const ICON =
  'absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--sw-neutral-400)] flex items-center pointer-events-none';

const LABEL = 'text-sm font-medium text-[var(--sw-secondary-700)]';

const PRIMARY_BTN =
  'mt-1 px-6 py-3.5 rounded-full bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] font-extrabold text-base border-0 cursor-pointer shadow-[var(--sw-shadow-primary)] w-full transition-[transform,box-shadow,background] duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0';

const GHOST_LINK =
  'text-[var(--sw-primary-600)] text-sm font-semibold bg-transparent border-0 cursor-pointer hover:underline disabled:opacity-50';

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedPhone = normalizeSaudiPhone(phone);
    if (!normalizedPhone) {
      setError(t('auth.invalidPhone'));
      return;
    }
    setIsLoading(true);
    try {
      await requestOtp({
        channel: OtpChannel.SMS,
        identifier: normalizedPhone,
        purpose: OtpPurpose.CLIENT_LOGIN,
      });
      // Keep the normalized E.164 form so the OTP step shows exactly what
      // the SMS was sent to, and verification matches the request.
      setPhone(normalizedPhone);
      setStep('otp');
    } catch {
      setError(t('auth.failedToSendCode'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOtpSubmit() {
    if (otpCode.length !== 4) {
      setError(t('auth.enterSixDigitCode'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyOtp(phone, otpCode, OtpPurpose.CLIENT_LOGIN, OtpChannel.SMS);
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
    const pwError = validatePassword(password);
    if (pwError) {
      setError(t(pwError as MessageKey));
      return;
    }
    if (!otpToken) {
      setError(t('auth.sessionExpired'));
      setStep('credentials');
      return;
    }
    setIsLoading(true);
    try {
      await clientRegisterApi({
        otpSessionToken: otpToken,
        password,
        name: name || undefined,
      });
      const profile = await getMeApi();
      setClient(profile);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/account');
      }
    } catch {
      setError(t('auth.registerFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Stepper current={step} />

      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm leading-normal bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]"
          role="alert"
        >
          {error}
        </div>
      )}

      {step === 'credentials' && (
        <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-[1.125rem]">
          <Field id="name" label={t('auth.fullName')} icon={<User size={16} />}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.fullNamePlaceholder')}
              autoComplete="name"
              className={INPUT}
            />
          </Field>
          <Field id="reg-phone" label={t('auth.phone')} icon={<Phone size={16} />}>
            <input
              id="reg-phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05XXXXXXXX"
              autoComplete="tel"
              required
              className={`${INPUT} text-start`}
            />
          </Field>
          <button type="submit" disabled={isLoading} className={PRIMARY_BTN}>
            {isLoading ? t('auth.sendingCode') : t('auth.continueAsClient')}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <div className="flex flex-col gap-[1.125rem]">
          <p className="text-sm text-[var(--sw-body)] leading-relaxed">
            {t('auth.codeSent')}{' '}
            <span className="font-semibold text-[var(--sw-secondary-700)]" dir="ltr">
              {phone}
            </span>
          </p>
          <Field id="otp" label={t('auth.verificationCode')} icon={<KeyRound size={16} />}>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
              placeholder="0000"
              className={`${INPUT} text-2xl tracking-[0.5em] text-center font-semibold`}
            />
          </Field>
          <button
            onClick={handleOtpSubmit}
            disabled={isLoading || otpCode.length !== 4}
            className={PRIMARY_BTN}
          >
            {isLoading ? t('auth.verifying') : t('auth.verify')}
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpCode('');
              setError(null);
              setStep('credentials');
            }}
            className={`${GHOST_LINK} text-center mx-auto`}
          >
            {t('auth.changePhone')}
          </button>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-[1.125rem]">
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[color-mix(in_srgb,var(--success)_8%,transparent)] border border-[color-mix(in_srgb,var(--success)_22%,transparent)]">
            <span className="mt-0.5 text-[var(--success)]" aria-hidden="true">
              <ArrowRight size={14} />
            </span>
            <p className="text-sm text-[var(--sw-secondary-700)] leading-relaxed">
              {t('auth.phoneVerifiedSetPassword')}
            </p>
          </div>
          <Field id="reg-password" label={t('auth.password')} icon={<Lock size={16} />}>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordHint')}
              autoComplete="new-password"
              required
              className={INPUT}
            />
          </Field>
          <p className="text-xs text-[var(--sw-neutral-500)] -mt-2">{t('auth.passwordHint')}</p>
          <button type="submit" disabled={isLoading} className={PRIMARY_BTN}>
            {isLoading ? t('auth.creatingAccount') : t('auth.register')}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <span className={ICON} aria-hidden="true">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const t = useT();
  const steps: { key: Step; label: string }[] = [
    { key: 'credentials', label: t('auth.step.phone') },
    { key: 'otp', label: t('auth.step.verify') },
    { key: 'password', label: t('auth.step.password') },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2" aria-label="progress">
      {steps.map((s, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <li key={s.key} className="flex-1 flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                done
                  ? 'bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)]'
                  : active
                  ? 'bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] shadow-[var(--sw-shadow-primary)]'
                  : 'bg-[var(--sw-neutral-100)] text-[var(--sw-neutral-500)]'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {idx + 1}
            </span>
            <span
              className={`hidden sm:inline text-xs font-medium ${
                active || done ? 'text-[var(--sw-secondary-700)]' : 'text-[var(--sw-neutral-500)]'
              }`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <span
                className={`flex-1 h-px ${
                  done ? 'bg-[var(--sw-primary-500)]' : 'bg-[var(--sw-neutral-200)]'
                }`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
