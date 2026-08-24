'use client';

import { useMemo, useRef, useState } from 'react';
import type { Service } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { rovingTabIndex, handleRadioGroupKeyDown } from './radio-group-nav';

interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface ServicePickerProps {
  services: Service[];
  categories: Category[];
  selected: Service | null;
  /**
   * Selects a service. Duration, attendance type and price are decided later
   * on the dedicated choice screen — this picker never collects them.
   */
  onSelect: (service: Service) => void;
  /**
   * Set when the user arrived from a therapist page (`?employeeId=...`)
   * without a service. We show a small banner explaining that the therapist
   * is held and they just need to pick a session.
   */
  lockedTherapistName?: string | null;
  onClearLockedTherapist?: () => void;
  /** Pre-select a category filter (e.g. when entering from a clinic page). */
  initialCategoryId?: string | null;
}

export function ServicePicker({
  services,
  categories,
  selected,
  onSelect,
  lockedTherapistName,
  onClearLockedTherapist,
  initialCategoryId = null,
}: ServicePickerProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const groupRef = useRef<HTMLUListElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategoryId);

  const usedCategoryIds = useMemo(
    () => new Set(services.map((s) => s.categoryId)),
    [services],
  );
  const visibleCategories = useMemo(
    () => categories.filter((c) => usedCategoryIds.has(c.id)),
    [categories, usedCategoryIds],
  );

  const filtered = activeCategory
    ? services.filter((s) => s.categoryId === activeCategory)
    : services;

  const showFilter = visibleCategories.length > 1;

  // Radio-group state over the visible (filtered) service cards. The DOM
  // order of the rendered radios matches `filtered`.
  const focusIndex = rovingTabIndex(
    filtered.map((s) => ({ disabled: false, selected: selected?.id === s.id })),
  );

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-[1.625rem] sm:text-[1.75rem] font-extrabold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.015em' }}
        >
          {t('booking.selectService')}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-body)' }}
        >
          {lockedTherapistName
            ? isAr
              ? `اختر نوع الجلسة، وراح نكمل حجز موعدك مع ${lockedTherapistName}.`
              : `Pick a session and we will continue your booking with ${lockedTherapistName}.`
            : isAr
              ? 'اختر نوع الجلسة اللي تناسبك.'
              : 'Pick the session that fits.'}
        </p>
      </header>

      {lockedTherapistName && (
        <div
          className="flex items-center gap-3 p-3 rounded-2xl"
          style={{
            background: 'color-mix(in srgb, var(--primary) 7%, #FFFFFF)',
            border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
          }}
          role="status"
        >
          <span
            aria-hidden="true"
            className="grid place-items-center h-9 w-9 shrink-0 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary-dark)' }}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="6" r="2.5" />
              <path d="M3.5 13.5c.5-2.4 2.3-4 4.5-4s4 1.6 4.5 4" />
            </svg>
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className="text-[0.6875rem] font-semibold"
              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
            >
              {isAr ? 'المعالج المختار' : 'Selected therapist'}
            </span>
            <span
              className="text-sm font-bold truncate"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {lockedTherapistName}
            </span>
          </div>
          {onClearLockedTherapist && (
            <button
              type="button"
              onClick={onClearLockedTherapist}
              className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
              style={{ color: 'var(--primary-dark)' }}
            >
              {isAr ? 'تغيير' : 'Change'}
            </button>
          )}
        </div>
      )}

      {showFilter && (
        <div
          className="flex items-center gap-1.5 -mx-4 sm:mx-0 overflow-x-auto sw-no-scrollbar px-4 sm:px-0"
          role="tablist"
          aria-label={t('booking.selectService')}
        >
          <CategoryTab
            label={t('booking.services.all')}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {visibleCategories.map((c) => (
            <CategoryTab
              key={c.id}
              label={isAr ? c.nameAr : c.nameEn}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div
          className="flex flex-col items-center text-center gap-3 px-6 py-10 rounded-2xl"
          style={{
            background: 'color-mix(in srgb, var(--primary) 4%, #FFFFFF)',
            border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 16%, transparent)',
          }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--sw-secondary-700)' }}>
            {isAr ? 'لا توجد خدمات متاحة في هذا الفرع' : 'No services available at this branch'}
          </p>
          <p
            className="text-xs max-w-[44ch] leading-relaxed"
            style={{ color: 'var(--sw-body)' }}
          >
            {isAr
              ? 'جرّب اختيار فرع آخر — كل فرع له خدماته ومعالجوه.'
              : 'Try a different branch — services and therapists vary by branch.'}
          </p>
        </div>
      )}

      <ul
        ref={groupRef}
        className="flex flex-col gap-3"
        role="radiogroup"
        aria-label={t('booking.selectService')}
        onKeyDown={(e) =>
          handleRadioGroupKeyDown(
            e,
            groupRef.current!,
            (i) => onSelect(filtered[i]),
            { axis: 'both', rtl: isAr },
          )
        }
      >
        {filtered.map((service, i) => {
          const isSelected = selected?.id === service.id;
          const name = isAr ? service.nameAr : service.nameEn;
          const description = isAr ? service.descriptionAr : service.descriptionEn;

          return (
            <li key={service.id}>
              <div
                className="rounded-[1.25rem] bg-white transition-all duration-200"
                style={{
                  border: isSelected
                    ? '1.5px solid var(--primary)'
                    : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
                  boxShadow: isSelected ? 'var(--sw-shadow-md)' : 'var(--sw-shadow-xs)',
                }}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={i === focusIndex ? 0 : -1}
                  onClick={() => onSelect(service)}
                  className="group w-full text-start cursor-pointer rounded-[1.25rem] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    const card = e.currentTarget.parentElement!;
                    card.style.borderColor = 'color-mix(in srgb, var(--primary) 55%, transparent)';
                    card.style.boxShadow = 'var(--sw-shadow-md)';
                    card.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) return;
                    const card = e.currentTarget.parentElement!;
                    card.style.borderColor =
                      'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)';
                    card.style.boxShadow = 'var(--sw-shadow-xs)';
                    card.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="flex flex-col min-w-0 flex-1 gap-1.5">
                      <span
                        className="font-bold text-base sm:text-[1.0625rem] leading-snug"
                        style={{ color: 'var(--sw-secondary-700)' }}
                      >
                        {name}
                      </span>
                      {description && (
                        <span
                          className="text-[0.8125rem] font-medium leading-relaxed"
                          style={{ color: 'var(--sw-body)' }}
                        >
                          {description}
                        </span>
                      )}
                    </div>

                    <span
                      aria-hidden="true"
                      className="grid place-items-center h-8 w-8 shrink-0 rounded-full transition-all duration-200 group-hover:bg-[var(--primary)] group-hover:text-white"
                      style={{
                        background: 'color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)',
                        color: 'var(--sw-secondary-700)',
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </span>
                  </div>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="shrink-0 px-4 py-2 text-[0.8125rem] rounded-full transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
      style={{
        background: active ? 'var(--sw-secondary-700)' : '#FFFFFF',
        color: active ? '#FFFFFF' : 'var(--sw-secondary-700)',
        fontWeight: active ? 700 : 600,
        border: active
          ? '1.5px solid var(--sw-secondary-700)'
          : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 12%, transparent)',
        boxShadow: active ? 'var(--sw-shadow-sm)' : 'none',
      }}
    >
      {label}
    </button>
  );
}
