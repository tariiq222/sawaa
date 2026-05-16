'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { validateEmail } from './auth.schema';
import { clientLoginApi } from './auth.api';
import { setClient } from './auth-store';
import { getMeApi } from './auth.api';

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
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: 'color-mix(in srgb, var(--error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            borderRadius: '8px',
            color: 'var(--error)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {t('auth.email')}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
          autoComplete="email"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
            background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
            fontSize: '1rem',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {t('auth.password')}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
            background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
            fontSize: '1rem',
            outline: 'none',
          }}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: '0.875rem',
          borderRadius: '8px',
          background: 'var(--primary)',
          color: 'var(--on-primary)',
          fontWeight: 600,
          fontSize: '1rem',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.875rem', opacity: 0.8 }}>
        <a href="/forgot-password" style={{ color: 'var(--primary)' }}>
          {t('auth.forgotPassword')}
        </a>
      </p>
    </form>
  );
}
