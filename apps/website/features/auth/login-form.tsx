'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { validateEmail } from './auth.schema';
import { clientLoginApi } from './auth.api';
import { setClient } from './auth-store';
import { getMeApi } from './auth.api';
import { Mail, Lock } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await clientLoginApi({ email, password });
      const profile = await getMeApi();
      setClient(profile);
      if (onSuccess) {
        onSuccess();
      } else {
        // Preserve full query string from the redirect param (e.g. /support-groups?groupId=xxx)
        const target = redirectTo
          ? `${redirectTo}${searchParams.get('groupId') ? `?groupId=${searchParams.get('groupId')}` : ''}`
          : '/account';
        router.push(target);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'color-mix(in srgb, var(--error) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
            borderRadius: '12px',
            color: 'var(--error)',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Email field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="email"
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--sw-secondary-700)',
          }}
        >
          {t('auth.email')}
        </label>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              insetInlineStart: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--sw-neutral-400)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <Mail size={16} />
          </span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            autoComplete="email"
            style={{
              width: '100%',
              paddingBlock: '0.75rem',
              paddingInlineStart: '2.625rem',
              paddingInlineEnd: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--sw-neutral-200)',
              background: 'var(--sw-neutral-50)',
              fontSize: '1rem',
              color: 'var(--sw-secondary-700)',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--sw-primary-500)';
              e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--sw-primary-500) 15%, transparent)';
              e.currentTarget.style.background = 'var(--sw-neutral-0)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--sw-neutral-200)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'var(--sw-neutral-50)';
            }}
          />
        </div>
      </div>

      {/* Password field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="password"
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--sw-secondary-700)',
          }}
        >
          {t('auth.password')}
        </label>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              insetInlineStart: '0.875rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--sw-neutral-400)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <Lock size={16} />
          </span>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{
              width: '100%',
              paddingBlock: '0.75rem',
              paddingInlineStart: '2.625rem',
              paddingInlineEnd: '1rem',
              borderRadius: '12px',
              border: '1px solid var(--sw-neutral-200)',
              background: 'var(--sw-neutral-50)',
              fontSize: '1rem',
              color: 'var(--sw-secondary-700)',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--sw-primary-500)';
              e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--sw-primary-500) 15%, transparent)';
              e.currentTarget.style.background = 'var(--sw-neutral-0)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--sw-neutral-200)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = 'var(--sw-neutral-50)';
            }}
          />
        </div>
      </div>

      {/* Forgot password */}
      <p style={{ textAlign: 'start', margin: '-0.25rem 0 0' }}>
        <a
          href="/forgot-password"
          style={{
            color: 'var(--sw-primary-600)',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          {t('auth.forgotPassword')}
        </a>
      </p>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        style={{
          marginTop: '0.25rem',
          padding: '0.875rem 1.5rem',
          borderRadius: '9999px',
          background: isLoading
            ? 'color-mix(in srgb, var(--sw-primary-500) 60%, transparent)'
            : 'var(--sw-primary-500)',
          color: 'var(--sw-neutral-0)',
          fontWeight: 800,
          fontSize: '1rem',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          boxShadow: isLoading ? 'none' : 'var(--sw-shadow-primary)',
          transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
      </button>
    </form>
  );
}
