'use client';

import { useState } from 'react';
import type { AvailableSlot, Service, EmployeeWithUser } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { clientLoginApi, getMeApi } from '@/features/auth/auth.api';
import { setClient as setAuthClient } from '@/features/auth/auth-store';
import { useCurrentClient } from '@/features/auth/use-current-client';
import { grossWithVat, halalasToSarNumber } from '@/lib/money';
import { therapistDisplayName } from './therapist-name';

interface ClientInfoStepProps {
  slot: AvailableSlot;
  service: Service;
  employee: EmployeeWithUser;
  /**
   * Fractional org VAT rate (0.15 = 15%). Display-only: the total is shown
   * VAT-inclusive when > 0; the backend computes the real invoice.
   */
  vatRate?: number;
  /**
   * Pre-tax price in halalas for the chosen duration option. When provided,
   * this overrides service.price so the displayed total matches what the
   * backend derives from durationOptionId. Falls back to service.price when
   * absent (e.g. services with no duration options).
   */
  selectedPriceHalalas?: number;
  /** @deprecated back is handled by the wizard header — kept for compatibility */
  onBack?: () => void;
  /** Confirm + pay. The client is authenticated via the session cookie; no info is passed. */
  onSubmitInfo: () => void;
  isSubmitting: boolean;
}

const fieldLabelClass = 'block text-[0.8125rem] font-bold mb-2';
const fieldLabelStyle = {
  color: 'var(--sw-secondary-700)',
};

const baseInputClass =
  'w-full ps-11 pe-3.5 py-3.5 text-[0.9375rem] rounded-xl bg-white transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 placeholder:opacity-40';

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    border: invalid
      ? '1.5px solid var(--error)'
      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
    color: 'var(--sw-secondary-700)',
    fontWeight: 500,
  };
}

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 -translate-y-1/2 start-3.5 grid place-items-center pointer-events-none"
      style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
    >
      {children}
    </span>
  );
}

export function ClientInfoStep({ slot, service, employee, vatRate = 0, selectedPriceHalalas, onSubmitInfo, isSubmitting }: ClientInfoStepProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { client, isLoading: clientLoading, refetch } = useCurrentClient();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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
      await refetch();
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
  const therapistName = therapistDisplayName(employee, isAr);
  // VAT-inclusive (gross) total — mirrors the backend invoice math so the
  // amount shown here matches what the customer is actually charged.
  const effectivePrice = selectedPriceHalalas ?? service.price;
  const priceSar = Intl.NumberFormat(dateLocale, {
    style: 'decimal',
    maximumFractionDigits: 2,
  }).format(halalasToSarNumber(grossWithVat(effectivePrice, vatRate)));
  const vatPercent = Math.round(vatRate * 100);

  const isAuthed = client !== null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-[1.625rem] sm:text-[1.75rem] font-extrabold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.015em' }}
        >
          {isAr ? 'بياناتك' : 'Your details'}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-body)' }}
        >
          {isAuthed
            ? isAr
              ? 'تأكّد من بياناتك ثم أكّد الحجز والدفع.'
              : 'Confirm your details, then complete the booking and payment.'
            : isAr
              ? 'لإتمام الحجز، سجّل الدخول إلى حسابك أو أنشئ حساباً جديداً. بياناتك سرّية ولا تُستخدم خارج المركز.'
              : 'To book, sign in to your account or create one. Your data is private and never leaves the centre.'}
        </p>
      </header>

      {/* === Loading the session === */}
      {clientLoading && !isAuthed && (
        <div
          className="flex items-center justify-center gap-2 py-8 text-sm"
          style={{ color: 'var(--sw-body)' }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: 'currentColor', borderInlineStartColor: 'currentColor' }}
            aria-hidden="true"
          />
          {isAr ? 'جارٍ التحقق من حسابك…' : 'Checking your account…'}
        </div>
      )}

      {/* === NOT LOGGED IN: sign-in invitation + inline login === */}
      {!clientLoading && !isAuthed && (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-4 p-5 rounded-[1.25rem] bg-white"
            style={{
              border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
              boxShadow: 'var(--sw-shadow-sm)',
            }}
            onSubmit={(e) => {
              e.preventDefault();
              void handleInlineLogin();
            }}
            noValidate
          >
            <h3 className="text-sm font-bold" style={{ color: 'var(--sw-secondary-700)' }}>
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </h3>

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
                style={{ color: 'var(--error)' }}
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
              className="self-stretch inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99] enabled:cursor-pointer"
              style={{
                background: 'var(--primary)',
                color: '#FFFFFF',
                boxShadow: 'var(--sw-shadow-primary)',
              }}
            >
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
              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
            >
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </a>
          </form>

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)' }} />
            <span className="text-xs font-medium" style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}>
              {isAr ? 'أو' : 'or'}
            </span>
            <span className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)' }} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href="/register"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'color-mix(in srgb, var(--primary) 8%, #FFFFFF)',
                color: 'var(--primary-dark)',
                border: '1.5px solid color-mix(in srgb, var(--primary) 32%, transparent)',
              }}
            >
              {isAr ? 'إنشاء حساب جديد' : 'Create an account'}
            </a>
            <a
              href="/login"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'transparent',
                color: 'var(--sw-secondary-700)',
                border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 16%, transparent)',
              }}
            >
              {isAr ? 'صفحة تسجيل الدخول' : 'Go to sign-in page'}
            </a>
          </div>
        </div>
      )}

      {/* === LOGGED IN: confirm details + pay === */}
      {isAuthed && (
        <>
          <section
            aria-label={isAr ? 'بيانات الحساب' : 'Account details'}
            className="flex flex-col gap-3 p-4 rounded-[1.25rem] bg-white"
            style={{
              border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
              boxShadow: 'var(--sw-shadow-xs)',
            }}
          >
            <SummaryRow label={t('booking.fullName')} value={client.name || '—'} />
            {client.phone && <SummaryRow label={t('booking.phone')} value={client.phone} numeric />}
            {client.email && <SummaryRow label={t('booking.email')} value={client.email} />}
          </section>

          <section
            aria-label={t('booking.summary.title')}
            className="mt-1 flex flex-col gap-4 p-5 sm:p-6 rounded-[1.25rem]"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--accent) 28%, #FFFDF8) 0%, color-mix(in srgb, var(--accent) 14%, #FFFDF8) 100%)',
              border: '1px solid color-mix(in srgb, var(--accent-dark) 28%, transparent)',
              boxShadow: 'var(--sw-shadow-sm)',
            }}
          >
            <h3
              className="text-sm font-extrabold tracking-tight"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {t('booking.summary.title')}
            </h3>

            <dl className="flex flex-col gap-3 text-sm">
              <SummaryRow label={t('booking.summary.service')} value={isAr ? service.nameAr : service.nameEn} />
              <SummaryRow label={t('booking.summary.therapist')} value={therapistName} />
              <SummaryRow label={t('booking.summary.dateTime')} value={`${dateStr} · ${timeStr}`} numeric />
            </dl>

            <div
              className="flex justify-between items-baseline pt-3.5 mt-1"
              style={{ borderTop: '1px dashed color-mix(in srgb, var(--accent-dark) 40%, transparent)' }}
            >
              <span
                className="text-[0.6875rem] font-bold"
                style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
              >
                {t('booking.summary.total')}
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="flex items-baseline gap-1.5">
                  <span
                    className="text-2xl font-extrabold tabular-nums"
                    style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.01em' }}
                  >
                    {priceSar}
                  </span>
                  <span
                    className="text-[0.6875rem] font-semibold"
                    style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
                  >
                    {t('booking.summary.currency')}
                  </span>
                </span>
                {vatRate > 0 && (
                  <span
                    className="text-[0.6875rem] font-medium"
                    style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
                  >
                    {isAr
                      ? `شامل ضريبة القيمة المضافة (${vatPercent}%)`
                      : `incl. VAT (${vatPercent}%)`}
                  </span>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSubmitInfo()}
              disabled={isSubmitting}
              className="mt-1 inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-full text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
              style={{
                background: 'var(--primary)',
                color: '#FFFFFF',
                boxShadow: isSubmitting ? 'none' : 'var(--sw-shadow-primary)',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
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

            <p
              className="flex items-center justify-center gap-1.5 text-[0.6875rem] font-medium"
              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 48%, transparent)' }}
            >
              <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2.5" y="6" width="9" height="6" rx="1.5" />
                <path d="M4.5 6V4.5a2.5 2.5 0 1 1 5 0V6" />
              </svg>
              {isAr ? 'دفع آمن ومشفّر عبر ميسر' : 'Secure encrypted payment via Moyasar'}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <dt
        className="text-xs font-semibold shrink-0 pt-0.5"
        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 52%, transparent)' }}
      >
        {label}
      </dt>
      <dd
        className={`text-sm font-bold text-end min-w-0 ${numeric ? 'tabular-nums' : ''}`}
        style={{ color: 'var(--sw-secondary-700)' }}
      >
        {value}
      </dd>
    </div>
  );
}
