'use client';

import { BookingSkeleton } from '@/features/booking/booking-skeleton';
import type { PractitionerBookingOption } from '@/features/booking/booking.api';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { grossWithVat, halalasToSarNumber } from '@/lib/money';

/**
 * Presentational pieces of the booking screen. Moved verbatim out of
 * `booking-wizard.tsx`; markup, copy and classes are unchanged.
 */

export function IconButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="grid place-items-center h-10 w-10 rounded-full cursor-pointer transition-all bg-[var(--surface)]"
      style={{
        color: 'var(--sw-secondary-700)',
        border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)',
        boxShadow: 'var(--sw-shadow-xs)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 60%, transparent)';
        e.currentTarget.style.color = 'var(--primary-dark)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)';
        e.currentTarget.style.color = 'var(--sw-secondary-700)';
      }}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ current, labels }: { current: number; labels: string[] }) {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const total = labels.length;
  const counter = isAr ? `${current + 1} من ${total}` : `${current + 1} of ${total}`;
  return (
    <nav aria-label="Booking progress" className="mb-8 flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="text-sm font-extrabold tracking-tight"
          style={{ color: 'var(--sw-secondary-700)' }}
        >
          {labels[current]}
        </span>
        <span
          className="text-xs font-semibold tabular-nums shrink-0"
          style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
        >
          {counter}
        </span>
      </div>
      <ol
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {labels.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={`step-${i}`}
              aria-current={active ? 'step' : undefined}
              className="h-1 rounded-full transition-colors duration-300"
              style={{
                background: done
                  ? 'var(--primary)'
                  : active
                    ? 'color-mix(in srgb, var(--primary) 45%, transparent)'
                    : 'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
              }}
            >
              <span className="sr-only">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PractitionerChoicePicker({
  options,
  isLoading,
  isAr,
  vatRate,
  onSelect,
  t,
}: {
  options: PractitionerBookingOption[];
  isLoading: boolean;
  isAr: boolean;
  vatRate: number;
  onSelect: (choice: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' }) => void;
  t: ReturnType<typeof useT>;
}) {
  const fmt = (halalas: number) =>
    Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'decimal',
      maximumFractionDigits: 2,
    }).format(halalasToSarNumber(grossWithVat(halalas, vatRate)));

  if (isLoading) {
    return <BookingSkeleton count={3} />;
  }

  if (options.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--sw-body)' }}>
          {isAr ? 'لا توجد خيارات متاحة.' : 'No options available.'}
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-[1.625rem] sm:text-[1.75rem] font-extrabold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.015em' }}
        >
          {t('booking.step.choice')}
        </h2>
        <p className="text-sm leading-relaxed max-w-[52ch]" style={{ color: 'var(--sw-body)' }}>
          {isAr ? 'اختر مدة الجلسة وطريقة الحضور.' : 'Choose session duration and attendance type.'}
        </p>
      </header>
      <ul className="flex flex-col gap-3" role="list">
        {options.map((opt, i) => {
          return (
            <li key={`${opt.durationOptionId}-${opt.deliveryType}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect({ durationOptionId: opt.durationOptionId, deliveryType: opt.deliveryType })}
                className="w-full text-start rounded-[1.25rem] bg-[var(--surface)] transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                style={{
                  border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
                  boxShadow: 'var(--sw-shadow-xs)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 55%, transparent)';
                  e.currentTarget.style.boxShadow = 'var(--sw-shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)';
                  e.currentTarget.style.boxShadow = 'var(--sw-shadow-xs)';
                }}
              >
                <div className="flex items-center gap-4 p-4 sm:p-5">
                  <div className="flex flex-col min-w-0 flex-1 gap-1">
                    <span className="font-bold text-base leading-snug" style={{ color: 'var(--sw-secondary-700)' }}>
                      {opt.deliveryType === 'ONLINE'
                        ? isAr ? 'أونلاين' : 'Online'
                        : isAr ? 'حضوري' : 'In-person'}
                    </span>
                    <span className="text-[0.8125rem] font-medium" style={{ color: 'var(--sw-body)' }}>
                      {`${opt.durationMins} ${isAr ? 'دقيقة' : 'min'}`}
                    </span>
                    <span className="text-[0.75rem]" style={{ color: 'var(--sw-neutral-500)' }}>
                      {opt.deliveryType === 'ONLINE'
                        ? t('booking.delivery.onlineNote')
                        : t('booking.delivery.inPersonNote')}
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="flex items-baseline gap-1">
                      <span
                        className="font-extrabold tabular-nums leading-none text-xl sm:text-[1.375rem]"
                        style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.02em' }}
                      >
                        {fmt(opt.price)}
                      </span>
                      <span
                        className="text-[0.6875rem] font-semibold"
                        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
                      >
                        {t('booking.summary.currency')}
                      </span>
                    </span>
                    {vatRate > 0 && (
                      <span className="text-[0.625rem] font-medium" style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 45%, transparent)' }}>
                        {t('booking.price.inclVat')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
