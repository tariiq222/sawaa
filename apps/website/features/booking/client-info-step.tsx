'use client';

import { useId, useState } from 'react';
import type { GuestClientInfo, AvailableSlot, Service, EmployeeWithUser } from '@sawaa/shared';
import { OtpRequestForm } from '@/features/otp/otp-request-form';
import { OtpVerifyForm } from '@/features/otp/otp-verify-form';
import { useOtpSession } from '@/features/otp/use-otp-session';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { validateEmail } from '@/features/auth/auth.schema';
import { clientLoginApi, getMeApi } from '@/features/auth/auth.api';
import { setClient as setAuthClient } from '@/features/auth/auth-store';
import { halalasToSarNumber } from '@/lib/money';

function validateSaudiPhone(phone: string, isAr: boolean): string | null {
  const stripped = phone.replace(/\s+/g, '');
  if (/^\+9665\d{8}$/.test(stripped)) return null;
  if (/^9665\d{8}$/.test(stripped)) return null;
  if (/^05\d{8}$/.test(stripped)) return null;
  return isAr ? 'رقم الجوال غير صحيح' : 'Invalid phone number';
}

function localizeError(raw: string | null, isAr: boolean): string | undefined {
  if (!raw) return undefined;
  if (!isAr) return raw;
  switch (raw) {
    case 'Invalid email address':
      return 'البريد الإلكتروني غير صحيح';
    default:
      return raw;
  }
}

interface ClientInfoStepProps {
  slot: AvailableSlot;
  service: Service;
  employee: EmployeeWithUser;
  /** @deprecated back is handled by the wizard header — kept for compatibility */
  onBack?: () => void;
  onSubmitInfo: (client: GuestClientInfo) => void;
  isSubmitting: boolean;
}

const fieldLabelClass = 'block text-[0.8125rem] font-semibold mb-2';
const fieldLabelStyle = {
  color: 'var(--sw-secondary-900)',
};

const baseInputClass =
  'w-full ps-11 pe-3.5 py-3.5 text-[0.9375rem] rounded-xl bg-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sw-cream)] placeholder:opacity-40';

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    border: invalid
      ? '1.5px solid var(--destructive)'
      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 18%, transparent)',
    color: 'var(--sw-secondary-900)',
    fontWeight: 500,
  };
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 -translate-y-1/2 start-3.5 grid place-items-center pointer-events-none"
      style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
    >
      {children}
    </span>
  );
}

export function ClientInfoStep({ slot, service, employee, onSubmitInfo, isSubmitting }: ClientInfoStepProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [client, setClient] = useState<GuestClientInfo>({ name: '', phone: '', email: '' });
  const [otpStep, setOtpStep] = useState<'form' | 'request' | 'verify' | 'summary'>('form');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [mode, setMode] = useState<'guest' | 'login'>('guest');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const { token, storeToken } = useOtpSession();

  const handleInlineLogin = async () => {
    setLoginError(null);
    if (!loginEmail || !loginPassword) {
      setLoginError(isAr ? 'الرجاء إدخال البريد وكلمة المرور.' : 'Please enter email and password.');
      return;
    }
    setLoginLoading(true);
    try {
      await clientLoginApi({ email: loginEmail, password: loginPassword });
      const me = await getMeApi();
      setAuthClient(me);
      setClient({
        name: me.name ?? '',
        phone: me.phone ?? '',
        email: me.email ?? loginEmail,
      });
      setMode('guest');
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : isAr
            ? 'فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.'
            : 'Login failed. Check your email and password.',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();

  const hasFieldErrors = Boolean(fieldErrors.email || fieldErrors.phone);
  const isFormIncomplete = !client.name || !client.phone || !client.email;
  const verifyDisabled = hasFieldErrors || isFormIncomplete;
  const continueDisabled = isSubmitting || isFormIncomplete || hasFieldErrors;

  const showSummary = otpStep === 'summary' || (otpStep === 'form' && token && !isFormIncomplete);

  const start = new Date(slot.startTime);
  const dateLocale = isAr ? 'ar-SA' : 'en-US';
  const dateStr = start.toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeStr = start.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const therapistName = `${employee.user.firstName} ${employee.user.lastName}`.trim();
  const priceSar = Intl.NumberFormat(dateLocale, {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(halalasToSarNumber(service.price));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-2xl sm:text-[1.625rem] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-900)', letterSpacing: '-0.015em' }}
        >
          {isAr ? 'بياناتك' : 'Your details'}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-secondary-500)' }}
        >
          {isAr
            ? 'نحتاج بياناتك للتواصل وتأكيد الموعد. بياناتك سرّية ولا تُستخدم خارج المركز.'
            : 'We need your info to confirm the appointment. Your data is private and never leaves the centre.'}
        </p>
      </header>

      {/* Tabs: guest vs returning */}
      <div
        role="tablist"
        aria-label={isAr ? 'طريقة المتابعة' : 'How to continue'}
        className="grid grid-cols-2 gap-1 p-1 rounded-2xl"
        style={{
          background: 'color-mix(in srgb, var(--sw-secondary-700) 6%, white)',
          border: '1px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'guest'}
          onClick={() => setMode('guest')}
          className="px-3 py-2.5 text-sm rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          style={{
            background: mode === 'guest' ? 'var(--primary)' : 'transparent',
            color: mode === 'guest' ? '#FFFFFF' : 'var(--sw-secondary-500)',
            fontWeight: 700,
            boxShadow: mode === 'guest' ? '0 4px 10px -4px color-mix(in srgb, var(--primary) 50%, transparent)' : 'none',
          }}
        >
          {isAr ? 'حساب جديد' : 'New here'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => setMode('login')}
          className="px-3 py-2.5 text-sm rounded-xl transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          style={{
            background: mode === 'login' ? 'var(--primary)' : 'transparent',
            color: mode === 'login' ? '#FFFFFF' : 'var(--sw-secondary-500)',
            fontWeight: 700,
            boxShadow: mode === 'login' ? '0 4px 10px -4px color-mix(in srgb, var(--primary) 50%, transparent)' : 'none',
          }}
        >
          {isAr ? 'لدي حساب' : 'I have an account'}
        </button>
      </div>

      {/* Login form (collapses in/out without leaving the page) */}
      {mode === 'login' && (
        <form
          className="flex flex-col gap-4 p-4 rounded-2xl"
          style={{
            background: 'color-mix(in srgb, var(--primary) 4%, white)',
            border: '1.5px solid color-mix(in srgb, var(--primary) 18%, transparent)',
          }}
          onSubmit={(e) => {
            e.preventDefault();
            void handleInlineLogin();
          }}
          noValidate
        >
          <div className="flex flex-col">
            <label className={fieldLabelClass} style={fieldLabelStyle}>
              {isAr ? 'البريد الإلكتروني' : 'Email'}
            </label>
            <div className="relative">
              <FieldIcon>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                  <path d="M2.5 4.5l5.5 4 5.5-4" />
                </svg>
              </FieldIcon>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                className={baseInputClass}
                style={inputStyle(false)}
                autoComplete="email"
                dir="ltr"
                required
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className={fieldLabelClass} style={fieldLabelStyle}>
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <FieldIcon>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
                  <path d="M5 7V5a3 3 0 1 1 6 0v2" />
                </svg>
              </FieldIcon>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className={baseInputClass}
                style={inputStyle(false)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {loginError && (
            <p
              role="alert"
              className="text-xs flex items-start gap-1.5 font-medium leading-relaxed"
              style={{ color: 'var(--destructive)' }}
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="6" cy="6" r="4.8" />
                <path d="M6 3.8v2.6M6 7.6v.4" strokeLinecap="round" />
              </svg>
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="self-stretch inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
            style={{
              background: 'var(--primary)',
              color: '#FFFFFF',
              boxShadow: '0 6px 16px -6px color-mix(in srgb, var(--primary) 55%, transparent)',
            }}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5v-1a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-1" />
              <path d="M14 8h-7M11.5 5l3 3-3 3" />
            </svg>
            {loginLoading
              ? isAr
                ? 'جاري الدخول…'
                : 'Signing in…'
              : isAr
                ? 'تسجيل الدخول'
                : 'Sign in'}
          </button>

          <a
            href="/forgot-password"
            className="self-center text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: 'var(--sw-secondary-500)' }}
          >
            {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
          </a>
        </form>
      )}

      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
        noValidate
        hidden={mode !== 'guest'}
      >
        <div className="flex flex-col">
          <label htmlFor={nameId} className={fieldLabelClass} style={fieldLabelStyle}>
            {t('booking.fullName')}
          </label>
          <div className="relative">
            <FieldIcon>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="5.5" r="2.6" />
                <path d="M3 14c.7-2.6 2.7-4.2 5-4.2s4.3 1.6 5 4.2" />
              </svg>
            </FieldIcon>
            <input
              id={nameId}
              type="text"
              value={client.name}
              onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
              placeholder={isAr ? 'مثال: محمد الزهراني' : 'e.g. Mohammed Alzahrani'}
              className={baseInputClass}
              style={inputStyle(false)}
              autoComplete="name"
              required
              maxLength={80}
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor={phoneId} className={fieldLabelClass} style={fieldLabelStyle}>
            {t('booking.phone')}
          </label>
          <div className="relative">
            <FieldIcon>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 2.5h3l1.2 3-1.6 1.1a8.5 8.5 0 0 0 3.3 3.3l1.1-1.6 3 1.2v3a1 1 0 0 1-1.1 1A11.5 11.5 0 0 1 2.5 3.6a1 1 0 0 1 1-1.1z" />
              </svg>
            </FieldIcon>
            <input
              id={phoneId}
              type="tel"
              value={client.phone}
              onChange={(e) => {
                const v = e.target.value;
                setClient((c) => ({ ...c, phone: v }));
                if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
              }}
              onBlur={(e) => {
                const err = validateSaudiPhone(e.target.value, isAr);
                setFieldErrors((p) => ({ ...p, phone: err ?? undefined }));
              }}
              placeholder="+9665XXXXXXXX"
              className={`${baseInputClass} tabular-nums`}
              style={inputStyle(Boolean(fieldErrors.phone))}
              autoComplete="tel"
              inputMode="tel"
              dir="ltr"
              required
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? `${phoneId}-error` : undefined}
            />
          </div>
          {fieldErrors.phone && (
            <p
              id={`${phoneId}-error`}
              role="alert"
              className="text-xs mt-1.5 flex items-center gap-1.5 font-medium"
              style={{ color: 'var(--destructive)' }}
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="6" cy="6" r="4.8" />
                <path d="M6 3.8v2.6M6 7.6v.4" strokeLinecap="round" />
              </svg>
              {fieldErrors.phone}
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor={emailId} className={fieldLabelClass} style={fieldLabelStyle}>
            {t('booking.email')}
          </label>
          <div className="relative">
            <FieldIcon>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                <path d="M2.5 4.5l5.5 4 5.5-4" />
              </svg>
            </FieldIcon>
            <input
              id={emailId}
              type="email"
              value={client.email}
              onChange={(e) => {
                const v = e.target.value;
                setClient((c) => ({ ...c, email: v }));
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              onBlur={(e) => {
                const err = localizeError(validateEmail(e.target.value), isAr);
                setFieldErrors((p) => ({ ...p, email: err }));
              }}
              placeholder="name@example.com"
              className={baseInputClass}
              style={inputStyle(Boolean(fieldErrors.email))}
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p
              id={`${emailId}-error`}
              role="alert"
              className="text-xs mt-1.5 flex items-center gap-1.5 font-medium"
              style={{ color: 'var(--destructive)' }}
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="6" cy="6" r="4.8" />
                <path d="M6 3.8v2.6M6 7.6v.4" strokeLinecap="round" />
              </svg>
              {fieldErrors.email}
            </p>
          )}
        </div>
      </form>

      {otpStep === 'request' && (
        <OtpRequestForm client={client} onRequestSent={() => setOtpStep('verify')} />
      )}

      {otpStep === 'verify' && (
        <OtpVerifyForm
          client={client}
          onVerified={(tok) => {
            storeToken(tok);
            setOtpStep('form');
          }}
        />
      )}

      {mode === 'guest' && otpStep === 'form' && !token && (
        <button
          type="button"
          onClick={() => setOtpStep('request')}
          disabled={verifyDisabled}
          className="self-stretch inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
          style={{
            background: 'var(--primary)',
            color: '#FFFFFF',
            boxShadow: verifyDisabled ? 'none' : '0 6px 16px -6px color-mix(in srgb, var(--primary) 55%, transparent)',
            cursor: verifyDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
            <path d="M2.5 5.5L8 9l5.5-3.5" />
          </svg>
          {t('booking.verifyEmail')}
        </button>
      )}

      {showSummary && (
        <section
          aria-label={t('booking.summary.title')}
          className="mt-1 flex flex-col gap-4 p-5 sm:p-6 rounded-2xl"
          style={{
            background: 'var(--sw-cream)',
            border: '1px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)',
            boxShadow: 'var(--sw-shadow-sm)',
          }}
        >
          <header className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
              </svg>
            </span>
            <h3
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {t('booking.summary.title')}
            </h3>
          </header>

          <dl className="flex flex-col gap-3 text-sm">
            <SummaryRow label={t('booking.summary.service')} value={isAr ? service.nameAr : service.nameEn} />
            <SummaryRow label={t('booking.summary.therapist')} value={therapistName} />
            <SummaryRow label={t('booking.summary.dateTime')} value={`${dateStr} · ${timeStr}`} numeric />
          </dl>

          <div
            className="flex justify-between items-baseline pt-3 mt-1"
            style={{ borderTop: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)' }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)', letterSpacing: '0.04em' }}
            >
              {t('booking.summary.total')}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.01em' }}
              >
                {priceSar}
              </span>
              <span
                className="text-[0.6875rem] font-medium uppercase"
                style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)', letterSpacing: '0.05em' }}
              >
                {t('booking.summary.currency')}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => onSubmitInfo(client)}
            disabled={continueDisabled}
            className="mt-1 inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: continueDisabled ? 'none' : 'var(--sw-shadow-primary)',
              cursor: continueDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-transparent animate-spin"
                  style={{
                    borderTopColor: 'currentColor',
                    borderInlineStartColor: 'currentColor',
                  }}
                  aria-hidden="true"
                />
                {t('booking.processing')}
              </>
            ) : (
              <>
                {t('booking.confirmAndPay')}
                <svg viewBox="0 0 16 16" className="h-4 w-4 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 4l4 4-4 4" />
                  <path d="M2 8h12" />
                </svg>
              </>
            )}
          </button>
        </section>
      )}
    </div>
  );
}

function SummaryRow({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <dt
        className="text-xs font-medium shrink-0 pt-0.5"
        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
      >
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-end min-w-0 ${numeric ? 'tabular-nums' : ''}`}
        style={{ color: 'var(--sw-secondary-700)' }}
      >
        {value}
      </dd>
    </div>
  );
}
