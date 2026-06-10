'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { validateEmail, normalizeSaudiPhone } from './auth.schema';
import { clientLoginApi } from './auth.api';
import { setClient } from './auth-store';
import { getMeApi } from './auth.api';
import { User, Lock } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // The identifier is either an email (contains '@') or a Saudi phone.
    const trimmed = identifier.trim();
    let credentials: { email: string; password: string } | { phone: string; password: string };
    if (trimmed.includes('@')) {
      const emailError = validateEmail(trimmed);
      if (emailError) {
        setError(emailError);
        return;
      }
      credentials = { email: trimmed, password };
    } else {
      const normalizedPhone = normalizeSaudiPhone(trimmed);
      if (!normalizedPhone) {
        setError(t('auth.invalidPhone'));
        return;
      }
      credentials = { phone: normalizedPhone, password };
    }

    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await clientLoginApi(credentials);
      const profile = await getMeApi();
      setClient(profile);
      if (onSuccess) {
        onSuccess();
      } else {
        // SECURITY (P1): only follow a `redirect` param that is a same-origin
        // absolute path. `//evil.com` and `https://evil.com/foo` are now
        // rejected and fall through to /account. Reject anything that doesn't
        // start with a single `/` followed by a non-slash, and anything that
        // contains a backslash or control characters (browser quirks).
        const isSafeRelativePath =
          typeof redirectTo === 'string' &&
          /^\/(?![/\\])[A-Za-z0-9_\-./?&=%:]*$/.test(redirectTo);
        const groupId = searchParams.get('groupId');
        const target = isSafeRelativePath
          ? `${redirectTo}${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''}`
          : '/account';
        router.push(target);
      }
    } catch {
      setError(t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    'w-full py-3 ps-[2.625rem] pe-4 rounded-xl border border-[var(--sw-neutral-200)] bg-[var(--sw-neutral-50)] text-base text-[var(--sw-secondary-700)] outline-none box-border transition-[border-color,box-shadow] duration-150 focus:border-[var(--sw-primary-500)] focus:bg-[var(--sw-neutral-0)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sw-primary-500)_15%,transparent)]';

  const iconClass =
    'absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--sw-neutral-400)] flex items-center pointer-events-none';

  const labelClass = 'text-sm font-medium text-[var(--sw-secondary-700)]';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[1.125rem]">
      {/* Error message */}
      {error && (
        <div
          className="px-4 py-3 rounded-xl text-sm leading-normal bg-[color-mix(in_srgb,var(--error)_8%,transparent)] border border-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error)]"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Identifier field — email or Saudi phone */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className={labelClass}>
          {t('auth.emailOrPhone')}
        </label>
        <div className="relative">
          <span className={iconClass} aria-hidden="true">
            <User size={16} />
          </span>
          <input
            id="identifier"
            type="text"
            dir="ltr"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="05XXXXXXXX"
            autoComplete="username"
            className={`${inputClass} text-start`}
          />
        </div>
      </div>

      {/* Password field */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClass}>
          {t('auth.password')}
        </label>
        <div className="relative">
          <span className={iconClass} aria-hidden="true">
            <Lock size={16} />
          </span>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
      </div>

      {/* Forgot password */}
      <p className="text-start -mt-1 mb-0">
        <a
          href="/forgot-password"
          className="text-[var(--sw-primary-600)] text-[0.8125rem] font-medium"
        >
          {t('auth.forgotPassword')}
        </a>
      </p>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 px-6 py-3.5 rounded-full bg-[var(--sw-primary-500)] text-[var(--sw-neutral-0)] font-extrabold text-base border-0 cursor-pointer shadow-[var(--sw-shadow-primary)] w-full transition-[transform,box-shadow,background] duration-150 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
      >
        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
      </button>
    </form>
  );
}
