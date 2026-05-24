'use client';

import type { Service, EmployeeWithUser, AvailableSlot } from '@sawaa/shared';
import { halalasToSarNumber } from '@/lib/money';
import { useT, useLocale } from '@/features/locale/locale-provider';

interface BookingSummaryProps {
  service: Service;
  employee: EmployeeWithUser;
  slot: AvailableSlot;
  totalHalalat: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function BookingSummary({
  service,
  employee,
  slot,
  totalHalalat,
  onConfirm,
  isSubmitting,
}: BookingSummaryProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const dateLocale = isAr ? 'ar-SA' : 'en-US';

  const start = new Date(slot.startTime);
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
  }).format(halalasToSarNumber(totalHalalat));

  return (
    <section
      aria-label={t('booking.summary.title')}
      className="flex flex-col gap-5 p-5 sm:p-6 rounded-2xl"
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
        <h2
          className="text-sm font-semibold tracking-tight"
          style={{ color: 'var(--sw-secondary-700)' }}
        >
          {t('booking.summary.title')}
        </h2>
      </header>

      <dl className="flex flex-col gap-3 text-sm">
        <Row label={t('booking.summary.service')} value={isAr ? service.nameAr : service.nameEn} />
        <Row label={t('booking.summary.therapist')} value={therapistName} />
        <Row label={t('booking.summary.dateTime')} value={`${dateStr} · ${timeStr}`} numeric />
      </dl>

      <div
        className="flex justify-between items-baseline pt-3"
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
        onClick={onConfirm}
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:active:scale-[0.99]"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
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
    </section>
  );
}

function Row({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
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
