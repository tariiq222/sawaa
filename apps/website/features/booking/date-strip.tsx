'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useT } from '@/features/locale/locale-provider';

interface DateStripProps {
  value: string; // YYYY-MM-DD (local)
  onChange: (iso: string) => void;
  /** How many days to show in the horizontal strip (default 14). */
  days?: number;
  /**
   * Days of week (0=Sun..6=Sat) the underlying resource has availability rules
   * for. Days NOT in this set are rendered disabled/greyed-out. When undefined,
   * all weekdays are enabled. Used as a fast fallback while `bookableDates`
   * loads.
   */
  allowedDaysOfWeek?: number[];
  /**
   * Concrete dates (YYYY-MM-DD) that actually have at least one open slot.
   * When provided, dominates `allowedDaysOfWeek` — only dates in this set are
   * enabled. Pass an empty set to grey everything out.
   */
  bookableDates?: Set<string>;
}

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateStrip({ value, onChange, days = 14, allowedDaysOfWeek, bookableDates }: DateStripProps) {
  const allowedSet = useMemo(
    () => (allowedDaysOfWeek && allowedDaysOfWeek.length > 0 ? new Set(allowedDaysOfWeek) : null),
    [allowedDaysOfWeek],
  );
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const dateLocale = isAr ? 'ar-SA' : 'en-US';

  const today = startOfDay(new Date());
  const [anchor, setAnchor] = useState<Date>(() => {
    // Anchor the visible window so the selected date is the first visible.
    const sel = value ? new Date(`${value}T00:00:00`) : today;
    const anchored = startOfDay(sel) < today ? today : startOfDay(sel);
    return anchored;
  });

  const visibleDays = useMemo(() => {
    return Array.from({ length: days }, (_, i) => addDays(anchor, i));
  }, [anchor, days]);

  const monthLabel = useMemo(() => {
    const first = visibleDays[0];
    const last = visibleDays[visibleDays.length - 1];
    const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
    const monthFmt = new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' });
    if (sameMonth) return monthFmt.format(first);
    const shortMonth = new Intl.DateTimeFormat(dateLocale, { month: 'short' });
    return `${shortMonth.format(first)} – ${monthFmt.format(last)}`;
  }, [visibleDays, dateLocale]);

  // Scroll the selected day into view when it changes
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selectedRef.current && stripRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [value, anchor]);

  const goPrev = () => {
    const candidate = addDays(anchor, -days);
    setAnchor(candidate < today ? today : candidate);
  };
  const goNext = () => setAnchor(addDays(anchor, days));
  const goToday = () => {
    setAnchor(today);
    onChange(isoLocal(today));
  };

  const canGoPrev = anchor > today;
  const isTodayVisible = visibleDays.some((d) => sameDay(d, today));

  return (
    <div className="flex flex-col gap-3">
      {/* Header: month label + jump buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-[0.6875rem] font-semibold"
            style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
          >
            {t('booking.selectDate')}
          </span>
          <span
            className="text-base sm:text-lg font-extrabold tracking-tight truncate"
            style={{ color: 'var(--sw-secondary-700)' }}
          >
            {monthLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isTodayVisible && (
            <button
              type="button"
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer"
              style={{
                background: 'color-mix(in srgb, var(--primary) 9%, #FFFFFF)',
                color: 'var(--primary-dark)',
                border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
              }}
            >
              {isAr ? 'اليوم' : 'Today'}
            </button>
          )}
          <ArrowButton
            direction="prev"
            disabled={!canGoPrev}
            ariaLabel={isAr ? 'أسبوع سابق' : 'Previous week'}
            onClick={goPrev}
            isAr={isAr}
          />
          <ArrowButton
            direction="next"
            ariaLabel={isAr ? 'أسبوع لاحق' : 'Next week'}
            onClick={goNext}
            isAr={isAr}
          />
        </div>
      </div>

      {/* Day strip */}
      <div
        ref={stripRef}
        className="date-strip-scroll flex gap-2 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scroll-smooth"
        role="radiogroup"
        aria-label={t('booking.selectDate')}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          .date-strip-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        {visibleDays.map((d) => {
          const iso = isoLocal(d);
          const isSelected = iso === value;
          const isToday = sameDay(d, today);
          const isPast = startOfDay(d) < today;
          // bookableDates (when present, even if empty) is authoritative — it
          // came from the per-day backend probe. allowedDaysOfWeek is the
          // fast-render fallback before the probe lands.
          const isUnavailable = bookableDates
            ? !bookableDates.has(iso)
            : allowedSet
              ? !allowedSet.has(d.getDay())
              : false;
          const isDisabled = isPast || isUnavailable;
          const weekday = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' }).format(d);
          const dayNum = new Intl.NumberFormat(dateLocale, { useGrouping: false }).format(d.getDate());
          const fullLabel = new Intl.DateTimeFormat(dateLocale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(d);

          return (
            <button
              key={iso}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={isUnavailable ? `${fullLabel} — ${isAr ? 'غير متاح' : 'unavailable'}` : fullLabel}
              disabled={isDisabled}
              onClick={() => onChange(iso)}
              className="group relative shrink-0 flex flex-col items-center justify-center gap-1 w-[60px] sm:w-[68px] py-3 rounded-2xl cursor-pointer transition-all duration-150 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
              style={
                isSelected
                  ? {
                      background: 'var(--primary)',
                      color: '#FFFFFF',
                      border: '1.5px solid var(--primary)',
                      boxShadow: 'var(--sw-shadow-primary)',
                    }
                  : isUnavailable
                    ? {
                        background: 'transparent',
                        color: 'color-mix(in srgb, var(--sw-secondary-700) 32%, transparent)',
                        border: '1.5px dashed color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
                      }
                    : isPast
                      ? {
                          background: '#FFFFFF',
                          color: 'var(--sw-secondary-700)',
                          border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)',
                          opacity: 0.4,
                        }
                      : {
                          background: '#FFFFFF',
                          color: 'var(--sw-secondary-700)',
                          border: `1.5px solid ${isToday ? 'color-mix(in srgb, var(--primary) 70%, transparent)' : 'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)'}`,
                          boxShadow: 'var(--sw-shadow-xs)',
                        }
              }
              onMouseEnter={(e) => {
                if (isSelected || isDisabled) return;
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 8%, #FFFFFF)';
              }}
              onMouseLeave={(e) => {
                if (isSelected || isDisabled) return;
                e.currentTarget.style.borderColor = isToday
                  ? 'color-mix(in srgb, var(--primary) 70%, transparent)'
                  : 'color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)';
                e.currentTarget.style.background = '#FFFFFF';
              }}
              title={isUnavailable ? (isAr ? 'لا توجد أوقات في هذا اليوم' : 'No availability on this day') : undefined}
            >
              <span
                className="text-[0.6875rem] font-semibold leading-none"
                style={{
                  color: isSelected
                    ? 'rgba(255, 255, 255, 0.85)'
                    : isUnavailable
                      ? 'color-mix(in srgb, var(--sw-secondary-700) 28%, transparent)'
                      : 'color-mix(in srgb, var(--sw-secondary-700) 58%, transparent)',
                }}
              >
                {weekday}
              </span>
              <span
                className="text-xl sm:text-2xl font-bold tabular-nums leading-none"
                style={{ letterSpacing: '-0.02em' }}
              >
                {dayNum}
              </span>
              {isToday && !isSelected && !isUnavailable && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 h-1 w-1 rounded-full"
                  style={{ background: 'var(--primary)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ArrowButton({
  direction,
  ariaLabel,
  onClick,
  disabled,
  isAr,
}: {
  direction: 'prev' | 'next';
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  isAr: boolean;
}) {
  // In RTL, the visual "prev" (older dates) sits on the RIGHT — the arrow
  // should still point in the direction of travel (back in time = right arrow
  // in RTL = scale-x-100 of the base path which points left).
  const flip = (direction === 'prev' && !isAr) || (direction === 'next' && isAr);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="grid place-items-center h-8 w-8 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: '#FFFFFF',
        color: 'var(--sw-secondary-700)',
        border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)',
        boxShadow: 'var(--sw-shadow-xs)',
      }}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      >
        <path d="M10 4l-4 4 4 4" />
      </svg>
    </button>
  );
}
