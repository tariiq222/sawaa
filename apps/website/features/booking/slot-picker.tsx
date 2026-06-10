'use client';

import type { AvailableSlot } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';

type Translate = ReturnType<typeof useT>;

interface SlotPickerProps {
  slots: AvailableSlot[];
  selected: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
  isLoading?: boolean;
}

type Period = 'morning' | 'afternoon' | 'evening';

function periodOf(date: Date): Period {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function PeriodIcon({ period }: { period: Period }) {
  if (period === 'morning') {
    // sunrise
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 10.5a2.8 2.8 0 0 1 2.8 2.8H5.2A2.8 2.8 0 0 1 8 10.5z" />
        <path d="M8 8V5.5M3.2 11.2l1.1-1.1M12.8 11.2l-1.1-1.1M2 13.3h1.2M12.8 13.3H14M5.5 4l2.5-2 2.5 2" />
      </svg>
    );
  }
  if (period === 'afternoon') {
    // sun
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="8" r="2.8" />
        <path d="M8 2v1.4M8 12.6V14M2 8h1.4M12.6 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1" />
      </svg>
    );
  }
  // moon
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 9.8A5.5 5.5 0 0 1 6.2 3a5.5 5.5 0 1 0 6.8 6.8z" />
    </svg>
  );
}

export function SlotPicker({ slots, selected, onSelect, isLoading }: SlotPickerProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';

  if (isLoading) {
    return <SlotsLoading isAr={isAr} t={t} />;
  }

  if (slots.length === 0) {
    return <SlotsEmptyState isAr={isAr} t={t} />;
  }

  const sorted = [...slots].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const groups: Array<{ period: Period; slots: AvailableSlot[] }> = [];
  for (const slot of sorted) {
    const period = periodOf(new Date(slot.startTime));
    const last = groups[groups.length - 1];
    if (last && last.period === period) {
      last.slots.push(slot);
    } else {
      groups.push({ period, slots: [slot] });
    }
  }

  const periodLabel: Record<Period, string> = {
    morning: t('booking.slots.morning'),
    afternoon: t('booking.slots.afternoon'),
    evening: t('booking.slots.evening'),
  };

  return (
    <div className="flex flex-col gap-5" role="group" aria-label={t('booking.selectTime')}>
      <h3
        className="text-base font-bold tracking-tight"
        style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.01em' }}
      >
        {t('booking.selectTime')}
      </h3>

      {groups.map(({ period, slots: groupSlots }) => (
        <section key={period} className="flex flex-col gap-2.5">
          <header
            className="flex items-center gap-1.5 text-xs font-bold"
            style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
          >
            <PeriodIcon period={period} />
            {periodLabel[period]}
            <span
              aria-hidden="true"
              className="h-px flex-1"
              style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }}
            />
          </header>

          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}
          >
            {groupSlots.map((slot) => {
              const start = new Date(slot.startTime);
              const timeStr = start.toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isSelected = selected?.startTime === slot.startTime;
              const ariaLabel = start.toLocaleString(isAr ? 'ar-SA' : 'en-US', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => onSelect(slot)}
                  aria-pressed={isSelected}
                  aria-label={ariaLabel}
                  className="px-2 py-3 cursor-pointer rounded-xl tabular-nums text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                  style={
                    isSelected
                      ? {
                          background: 'var(--primary)',
                          color: '#FFFFFF',
                          border: '1.5px solid var(--primary)',
                          fontWeight: 700,
                          boxShadow: 'var(--sw-shadow-primary)',
                        }
                      : {
                          background: '#FFFFFF',
                          color: 'var(--sw-secondary-700)',
                          border:
                            '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)',
                          fontWeight: 600,
                          boxShadow: 'var(--sw-shadow-xs)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--primary) 60%, transparent)';
                    e.currentTarget.style.background =
                      'color-mix(in srgb, var(--primary) 7%, #FFFFFF)';
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) return;
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)';
                    e.currentTarget.style.background = '#FFFFFF';
                  }}
                >
                  {timeStr}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SlotsLoading({ isAr, t }: { isAr: boolean; t: Translate }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-10"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-4 w-4 rounded-full border-2 border-transparent animate-spin"
        style={{
          borderTopColor: 'var(--primary)',
          borderInlineStartColor: 'var(--primary)',
        }}
        aria-hidden="true"
      />
      <span className="text-sm" style={{ color: 'var(--sw-body)' }}>
        {t('booking.loadingSlots')}
      </span>
      <span className="sr-only">{isAr ? 'جارٍ التحميل' : 'Loading'}</span>
    </div>
  );
}

function SlotsEmptyState({ isAr, t }: { isAr: boolean; t: Translate }) {
  return (
    <div
      className="flex flex-col items-center text-center gap-3 px-6 py-10 rounded-2xl"
      style={{
        background: 'color-mix(in srgb, var(--primary) 4%, #FFFFFF)',
        border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 16%, transparent)',
      }}
    >
      <span
        aria-hidden="true"
        className="grid place-items-center h-11 w-11 rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          color: 'var(--primary-dark)',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" />
        </svg>
      </span>
      <p className="text-sm font-bold" style={{ color: 'var(--sw-secondary-700)' }}>
        {t('booking.noSlots')}
      </p>
      <p
        className="text-xs max-w-[42ch] leading-relaxed"
        style={{ color: 'var(--sw-body)' }}
      >
        {isAr
          ? 'جرّب تاريخ ثاني من الأعلى — في العادة فيه مواعيد متاحة خلال الأسبوع.'
          : 'Try a different date above — slots are usually available within the week.'}
      </p>
    </div>
  );
}
