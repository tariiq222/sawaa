'use client';

import { useState } from 'react';
import type { GuestClientInfo } from '@sawaa/shared';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

interface OtpRequestFormProps {
  client: GuestClientInfo;
  onRequestSent: () => void;
}

export function OtpRequestForm({
  client,
  onRequestSent,
}: OtpRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const api = await import('./otp.api');
      await api.requestOtp({
        channel: OtpChannel.EMAIL,
        identifier: client.email,
        purpose: OtpPurpose.GUEST_BOOKING,
      });
      onRequestSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
        We will send a verification code to {client.email}
      </div>

      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
            borderRadius: 'var(--radius)',
            color: 'var(--destructive)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      <button
        onClick={handleRequest}
        disabled={isLoading}
        style={{
          padding: '0.875rem',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Sending...' : 'Send Verification Code'}
      </button>
    </div>
  );
}
