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

const inputClass =
  'w-full p-3 border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] rounded-[var(--radius)]';
const errorClass = 'text-[var(--destructive)] text-xs mt-1';
const primaryButtonClass =
  'p-3.5 font-semibold cursor-pointer rounded-[var(--radius)] bg-[var(--primary)] text-[var(--primary-foreground)] border-none disabled:opacity-60 disabled:cursor-not-allowed';

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
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start cursor-pointer bg-transparent border border-[color-mix(in_srgb,var(--primary)_30%,transparent)] rounded-[var(--radius)] px-4 py-2"
      >
        {t('booking.back')}
      </button>

      <div className="grid gap-3">
        <div>
          <label className="block text-sm mb-1">{t('booking.fullName')}</label>
          <input
            type="text"
            value={client.name}
            onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('booking.phone')}</label>
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
            className={inputClass}
          />
          {fieldErrors.phone && (
            <div className={errorClass}>
              {fieldErrors.phone}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">{t('booking.email')}</label>
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
            className={inputClass}
          />
          {fieldErrors.email && (
            <div className={errorClass}>
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
          className={primaryButtonClass}
        >
          {t('booking.verifyEmail')}
        </button>
      )}

      {otpStep === 'form' && token && (
        <button
          onClick={() => onSubmitInfo(client)}
          disabled={continueDisabled}
          className={primaryButtonClass}
        >
          {isSubmitting ? t('booking.processing') : t('booking.continueToPayment')}
        </button>
      )}
    </div>
  );
}
