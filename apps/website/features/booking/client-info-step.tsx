'use client';

import { useState } from 'react';
import type { GuestClientInfo, AvailableSlot } from '@deqah/shared';
import { OtpRequestForm } from '@/features/otp/otp-request-form';
import { OtpVerifyForm } from '@/features/otp/otp-verify-form';
import { useOtpSession } from '@/features/otp/use-otp-session';

interface ClientInfoStepProps {
  slot: AvailableSlot;
  onBack: () => void;
  onSubmitInfo: (client: GuestClientInfo) => void;
  isSubmitting: boolean;
}

export function ClientInfoStep({ onBack, onSubmitInfo, isSubmitting }: ClientInfoStepProps) {
  const [client, setClient] = useState<GuestClientInfo>({ name: '', phone: '', email: '' });
  const [otpStep, setOtpStep] = useState<'form' | 'request' | 'verify'>('form');
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);
  const { token, storeToken } = useOtpSession();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
          borderRadius: 'var(--radius)',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          alignSelf: 'start',
        }}
      >
        Back
      </button>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Full Name</label>
          <input
            type="text"
            value={client.name}
            onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
            style={{
              padding: '0.75rem',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              borderRadius: 'var(--radius)',
              width: '100%',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Phone</label>
          <input
            type="tel"
            value={client.phone}
            onChange={(e) => setClient((c) => ({ ...c, phone: e.target.value }))}
            placeholder="+966..."
            style={{
              padding: '0.75rem',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              borderRadius: 'var(--radius)',
              width: '100%',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Email</label>
          <input
            type="email"
            value={client.email}
            onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))}
            style={{
              padding: '0.75rem',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              borderRadius: 'var(--radius)',
              width: '100%',
            }}
          />
        </div>
      </div>

      {otpStep === 'request' && (
        <OtpRequestForm
          client={client}
          onHcaptchaVerify={setHcaptchaToken}
          hcaptchaToken={hcaptchaToken}
          onRequestSent={() => setOtpStep('verify')}
        />
      )}

      {otpStep === 'verify' && (
        <OtpVerifyForm
          client={client}
          onVerified={(t) => {
            storeToken(t);
            setOtpStep('form');
          }}
        />
      )}

      {otpStep === 'form' && !token && (
        <button
          onClick={() => setOtpStep('request')}
          style={{
            padding: '0.875rem',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Verify Email to Continue
        </button>
      )}

      {otpStep === 'form' && token && (
        <button
          onClick={() => onSubmitInfo(client)}
          disabled={isSubmitting || !client.name || !client.phone || !client.email}
          style={{
            padding: '0.875rem',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            cursor: isSubmitting || !client.name || !client.phone || !client.email ? 'not-allowed' : 'pointer',
            opacity: isSubmitting || !client.name || !client.phone || !client.email ? 0.6 : 1,
          }}
        >
          {isSubmitting ? 'Processing...' : 'Continue to Payment'}
        </button>
      )}
    </div>
  );
}
