'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { validateEmail } from './auth.schema';
import { requestOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

interface ForgotPasswordFormProps {
  onSuccess?: (email: string) => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="fp-email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          Email
        </label>
        <input
          id="fp-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
          autoComplete="email"
          required
          style={inputStyle()}
        />
      </div>
      <button type="submit" disabled={isLoading} style={primaryButtonStyle(isLoading)}>
        {isLoading ? 'Sending...' : 'Send Code'}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.875rem', opacity: 0.8 }}>
        <a href="/login" style={{ color: 'var(--primary)' }}>
          Back to Sign In
        </a>
      </p>
    </form>
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
