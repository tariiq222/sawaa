'use client';

import { useState } from 'react';
import type { GuestClientInfo, AvailableSlot } from '@sawaa/shared';
import { OtpRequestForm } from '@/features/otp/otp-request-form';
import { OtpVerifyForm } from '@/features/otp/otp-verify-form';
import { useOtpSession } from '@/features/otp/use-otp-session';
import { useT } from '@/features/locale/locale-provider';
import { validateEmail } from '@/features/auth/auth.schema';

function validateSaudiPhone(phone: string): string | null {
  const stripped = phone.replace(/\s+/g, '');
  if (/^\+9665\d{8}$/.test(stripped)) return null;
  if (/^9665\d{8}$/.test(stripped)) return null;
  if (/^05\d{8}$/.test(stripped)) return null;
  return 'رقم الجوال غير صحيح';
}

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
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const { token, storeToken } = useOtpSession();

  const hasFieldErrors = Boolean(fieldErrors.email || fieldErrors.phone);
  const isFormIncomplete = !client.name || !client.phone || !client.email;
  const verifyDisabled = hasFieldErrors || isFormIncomplete;
  const continueDisabled = isSubmitting || isFormIncomplete || hasFieldErrors;

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
            onChange={(e) => {
              const v = e.target.value;
              setClient((c) => ({ ...c, phone: v }));
              if (fieldErrors.phone) {
                setFieldErrors((p) => ({ ...p, phone: undefined }));
              }
            }}
            onBlur={(e) => {
              const err = validateSaudiPhone(e.target.value);
              setFieldErrors((p) => ({ ...p, phone: err ?? undefined }));
            }}
            placeholder="+966..."
            style={{
              padding: '0.75rem',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              borderRadius: 'var(--radius)',
              width: '100%',
            }}
          />
          {fieldErrors.phone && (
            <div style={{ color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {fieldErrors.phone}
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{t('booking.email')}</label>
          <input
            type="email"
            value={client.email}
            onChange={(e) => {
              const v = e.target.value;
              setClient((c) => ({ ...c, email: v }));
              if (fieldErrors.email) {
                setFieldErrors((p) => ({ ...p, email: undefined }));
              }
            }}
            onBlur={(e) => {
              const err = validateEmail(e.target.value);
              setFieldErrors((p) => ({ ...p, email: err ?? undefined }));
            }}
            style={{
              padding: '0.75rem',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              borderRadius: 'var(--radius)',
              width: '100%',
            }}
          />
          {fieldErrors.email && (
            <div style={{ color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {fieldErrors.email}
            </div>
          )}
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
          disabled={verifyDisabled}
          style={{
            padding: '0.875rem',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            cursor: verifyDisabled ? 'not-allowed' : 'pointer',
            opacity: verifyDisabled ? 0.6 : 1,
          }}
        >
          {t('booking.verifyEmail')}
        </button>
      )}

      {otpStep === 'form' && token && (
        <button
          onClick={() => onSubmitInfo(client)}
          disabled={continueDisabled}
          style={{
            padding: '0.875rem',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            cursor: continueDisabled ? 'not-allowed' : 'pointer',
            opacity: continueDisabled ? 0.6 : 1,
          }}
        >
          {isSubmitting ? t('booking.processing') : t('booking.continueToPayment')}
        </button>
      )}
    </div>
  );
}
