'use client';

import { useState } from 'react';
import type { GuestClientInfo } from '@deqah/shared';
import { OtpChannel, OtpPurpose } from '@deqah/shared';

interface OtpVerifyFormProps {
  client: GuestClientInfo;
  onVerified: (sessionToken: string) => void;
}

export function OtpVerifyForm({ client, onVerified }: OtpVerifyFormProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const api = await import('./otp.api');
      const result = await api.verifyOtp(client.email, code);
      onVerified(result.sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Verification Code
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          placeholder="000000"
          style={{
            padding: '0.75rem',
            fontSize: '1.5rem',
            letterSpacing: '0.5em',
            textAlign: 'center',
            border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
            borderRadius: 'var(--radius)',
            width: '100%',
          }}
        />
      </div>
      {error && (
        <div style={{ padding: '0.75rem', background: 'color-mix(in srgb, var(--destructive) 10%, transparent)', borderRadius: 'var(--radius)', color: 'var(--destructive)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      <button
        onClick={handleVerify}
        disabled={isLoading || code.length !== 6}
        style={{
          padding: '0.875rem',
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontWeight: 600,
          cursor: isLoading || code.length !== 6 ? 'not-allowed' : 'pointer',
          opacity: isLoading || code.length !== 6 ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Verifying...' : 'Verify'}
      </button>
    </div>
  );
}