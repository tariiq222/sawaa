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

  return (
    <div className="flex flex-col gap-4" role="group" aria-label={t('booking.selectTime')}>
      <h3
        className="text-base font-semibold tracking-tight"
        style={{ color: 'var(--sw-secondary-900)', letterSpacing: '-0.01em' }}
      >
        {t('booking.selectTime')}
      </h3>

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}
      >
        {sorted.map((slot) => {
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
              className="px-2 py-3 cursor-pointer rounded-xl tabular-nums text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sw-cream)]"
              style={
                isSelected
                  ? {
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                      border: '1.5px solid var(--primary)',
                      fontWeight: 700,
                      boxShadow: 'var(--sw-shadow-primary)',
                    }
                  : {
                      background: 'white',
                      color: 'var(--sw-secondary-900)',
                      border:
                        '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 18%, transparent)',
                      fontWeight: 600,
                    }
              }
              onMouseEnter={(e) => {
                if (isSelected) return;
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background =
                  'color-mix(in srgb, var(--primary) 6%, white)';
              }}
              onMouseLeave={(e) => {
                if (isSelected) return;
                e.currentTarget.style.borderColor =
                  'color-mix(in srgb, var(--sw-secondary-700) 18%, transparent)';
                e.currentTarget.style.background = 'white';
              }}
            >
              {timeStr}
            </button>
          );
        })}
      </div>
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
      <span
        className="text-sm"
        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 65%, transparent)' }}
      >
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
        background: 'color-mix(in srgb, var(--primary) 4%, var(--sw-cream))',
        border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
      }}
    >
      <span
        aria-hidden="true"
        className="grid place-items-center h-11 w-11 rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          color: 'var(--primary)',
        }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" />
        </svg>
      </span>
      <p
        className="text-sm font-semibold"
        style={{ color: 'var(--sw-secondary-700)' }}
      >
        {t('booking.noSlots')}
      </p>
      <p
        className="text-xs max-w-[42ch] leading-relaxed"
        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
      >
        {isAr
          ? 'جرّب تاريخ ثاني من الأعلى — في العادة فيه مواعيد متاحة خلال الأسبوع.'
          : 'Try a different date above — slots are usually available within the week.'}
      </p>
    </div>
  );
}
