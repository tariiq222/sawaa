'use client';

import { useRef, useState } from 'react';
import type HCaptcha from '@hcaptcha/react-hcaptcha';
import type { GuestClientInfo } from '@deqah/shared';
import { OtpChannel, OtpPurpose } from '@deqah/shared';
import { CaptchaField } from './captcha-field';

interface OtpRequestFormProps {
  client: GuestClientInfo;
  /** Current hCaptcha token (null until user completes the widget). */
  hcaptchaToken: string | null;
  /** Called when hCaptcha emits a new verified token. */
  onHcaptchaVerify: (token: string) => void;
  onRequestSent: () => void;
}

export function OtpRequestForm({
  client,
  hcaptchaToken,
  onHcaptchaVerify,
  onRequestSent,
}: OtpRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const handleRequest = async () => {
    if (!hcaptchaToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const api = await import('./otp.api');
      await api.requestOtp({
        channel: OtpChannel.EMAIL,
        identifier: client.email,
        purpose: OtpPurpose.GUEST_BOOKING,
        hCaptchaToken: hcaptchaToken,
      });
      onRequestSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
      // Reset widget so the user can re-verify after an error.
      captchaRef.current?.resetCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
        We will send a verification code to {client.email}
      </div>

      <CaptchaField
        ref={captchaRef}
        onVerify={(token) => onHcaptchaVerify(token)}
        onExpire={() => onHcaptchaVerify('')}
      />

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
        disabled={isLoading || !hcaptchaToken}
        style={{
          padding: '0.875rem',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontWeight: 600,
          cursor: isLoading || !hcaptchaToken ? 'not-allowed' : 'pointer',
          opacity: isLoading || !hcaptchaToken ? 0.6 : 1,
        }}
      >
        {isLoading ? 'Sending...' : 'Send Verification Code'}
      </button>
    </div>
  );
}
