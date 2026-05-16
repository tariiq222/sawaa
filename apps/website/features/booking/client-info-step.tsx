'use client';

import { useState } from 'react';
import type { GuestClientInfo, AvailableSlot } from '@sawaa/shared';
import { OtpRequestForm } from '@/features/otp/otp-request-form';
import { OtpVerifyForm } from '@/features/otp/otp-verify-form';
import { useOtpSession } from '@/features/otp/use-otp-session';
import { useT } from '@/features/locale/locale-provider';

interface ClientInfoStepProps {
  slot: AvailableSlot;
  onBack: () => void;
  onSubmitInfo: (client: GuestClientInfo) => void;
  isSubmitting: boolean;
}

export function ClientInfoStep({ onBack, onSubmitInfo, isSubmitting }: ClientInfoStepProps) {
  const t = useT();
  const [client, setClient] = useState<GuestClientInfo>({ name: '', phone: '', email: '' });
  const [otpStep, setOtpStep] = useState<'form' | 'request' | 'verify'>('form');
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
        {t('booking.back')}
      </button>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('booking.fullName')}</label>
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
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('booking.phone')}</label>
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
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('booking.email')}</label>
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
          {t('booking.verifyEmail')}
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
          {isSubmitting ? t('booking.processing') : t('booking.continueToPayment')}
        </button>
      )}
    </div>
  );
}
