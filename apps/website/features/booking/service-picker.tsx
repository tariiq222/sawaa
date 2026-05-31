'use client';

import { useMemo, useState } from 'react';
import type { Service } from '@sawaa/shared';
import { halalasToSarNumber } from '@/lib/money';
import { useT, useLocale } from '@/features/locale/locale-provider';

interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface ServicePickerProps {
  services: Service[];
  categories: Category[];
  selected: Service | null;
  onSelect: (
    service: Service,
    choice?: { durationOptionId: string; deliveryType: 'IN_PERSON' | 'ONLINE' },
  ) => void;
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
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategoryId);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<'IN_PERSON' | 'ONLINE' | null>(null);

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

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-2xl sm:text-[1.625rem] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-900)', letterSpacing: '-0.015em' }}
        >
          {t('booking.selectService')}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-secondary-500)' }}
        >
          {lockedTherapistName
            ? isAr
              ? `اختر نوع الجلسة، وراح نكمل الحجز مع ${lockedTherapistName}.`
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
            background: 'color-mix(in srgb, var(--primary) 7%, var(--sw-cream))',
            border: '1px solid color-mix(in srgb, var(--primary) 18%, transparent)',
          }}
          role="status"
        >
          <span
            aria-hidden="true"
            className="grid place-items-center h-8 w-8 shrink-0 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="6" r="2.5" />
              <path d="M3.5 13.5c.5-2.4 2.3-4 4.5-4s4 1.6 4.5 4" />
            </svg>
          </span>
          <div className="flex flex-col min-w-0 flex-1">
            <span
              className="text-xs"
              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
            >
              {isAr ? 'المعالج المختار' : 'Selected therapist'}
            </span>
            <span
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {lockedTherapistName}
            </span>
          </div>
          {onClearLockedTherapist && (
            <button
              type="button"
              onClick={onClearLockedTherapist}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer hover:bg-[color-mix(in_srgb,var(--sw-secondary-700)_6%,transparent)]"
              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 65%, transparent)' }}
            >
              {isAr ? 'تغيير' : 'Change'}
            </button>
          )}
        </div>
      )}

      {showFilter && (
        <div
          className="flex items-center gap-1 -mx-4 sm:mx-0 overflow-x-auto sw-no-scrollbar px-4 sm:px-0"
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
            background: 'color-mix(in srgb, var(--primary) 4%, white)',
            border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
          }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--sw-secondary-900)' }}>
            {isAr ? 'لا توجد خدمات متاحة في هذا الفرع' : 'No services available at this branch'}
          </p>
          <p
            className="text-xs max-w-[44ch] leading-relaxed"
            style={{ color: 'var(--sw-secondary-500)' }}
          >
            {isAr
              ? 'جرّب اختيار فرع آخر — كل فرع له خدماته ومعالجوه.'
              : 'Try a different branch — services and therapists vary by branch.'}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3" role="list">
        {filtered.map((service) => {
          const isSelected = selected?.id === service.id;
          const name = isAr ? service.nameAr : service.nameEn;
          const extended = service as Service & {
            durationMins?: number;
            bookingConfigs?: Array<{
              id: string;
              deliveryType: 'IN_PERSON' | 'ONLINE';
              price: number | string;
              durationMins: number;
            }>;
            durationOptions?: Array<{
              id: string;
              deliveryType: 'IN_PERSON' | 'ONLINE';
              label: string;
              labelAr: string | null;
              durationMins: number;
              price: number | string;
            }>;
          };
          const configs = extended.bookingConfigs ?? [];
          const durationOpts = extended.durationOptions ?? [];
          const fallbackDuration = extended.durationMins ?? service.duration ?? 0;
          const fallbackPrice = Number(service.price ?? 0);
          const showPrice = !service.hidePriceOnBooking;
          const showDuration = !service.hideDurationOnBooking;

          // Build the list of choices: prefer durationOptions when present,
          // otherwise fall back to bookingConfigs (one row per delivery type).
          type Choice = {
            id: string;
            deliveryType: 'IN_PERSON' | 'ONLINE';
            durationMins: number;
            price: number;
            label?: string;
          };
          const choices: Choice[] =
            durationOpts.length > 0
              ? durationOpts.map((o) => ({
                  id: o.id,
                  deliveryType: o.deliveryType,
                  durationMins: o.durationMins,
                  price: Number(o.price),
                  label: isAr ? o.labelAr ?? '' : o.label,
                }))
              : configs.map((c) => ({
                  id: c.id,
                  deliveryType: c.deliveryType,
                  durationMins: c.durationMins,
                  price: Number(c.price),
                }));

          const hasOptions = choices.length > 1;

          const numericPrices = choices.map((c) => c.price);
          const minPrice =
            numericPrices.length > 0 ? Math.min(...numericPrices) : fallbackPrice;
          const maxPrice =
            numericPrices.length > 0 ? Math.max(...numericPrices) : fallbackPrice;
          const fmt = (halalas: number) =>
            Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
              style: 'decimal',
              maximumFractionDigits: 0,
            }).format(halalasToSarNumber(halalas));
          const priceLabel =
            minPrice === maxPrice
              ? fmt(minPrice)
              : `${isAr ? 'من' : 'from'} ${fmt(minPrice)}`;

          const singleChoice = choices.length === 1 ? choices[0] : null;
          const displayDuration =
            singleChoice?.durationMins ?? fallbackDuration;
          const displayTypes: Array<'IN_PERSON' | 'ONLINE'> = Array.from(
            new Set(choices.map((c) => c.deliveryType)),
          ) as Array<'IN_PERSON' | 'ONLINE'>;

          const isOpen = pickerOpen === service.id;
          const stage: 'default' | 'type' | 'duration' =
            !isOpen ? 'default' : pickerType ? 'duration' : 'type';

          const handleHeaderClick = () => {
            if (!hasOptions) {
              onSelect(
                service,
                singleChoice
                  ? { durationOptionId: singleChoice.id, deliveryType: singleChoice.deliveryType }
                  : undefined,
              );
              return;
            }
            if (isOpen) {
              setPickerOpen(null);
              setPickerType(null);
            } else {
              setPickerOpen(service.id);
              setPickerType(displayTypes.length === 1 ? displayTypes[0] : null);
            }
          };

          const durationsForType = pickerType
            ? choices.filter((c) => c.deliveryType === pickerType).sort((a, b) => a.durationMins - b.durationMins)
            : [];

          return (
            <li key={service.id}>
              <div
                className="relative rounded-2xl bg-white transition-all duration-200"
                style={{
                  border: isSelected
                    ? '1.5px solid var(--primary)'
                    : isOpen
                      ? '1.5px solid var(--primary)'
                      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
                  boxShadow:
                    isSelected || isOpen ? 'var(--sw-shadow-primary)' : 'var(--sw-shadow-xs)',
                  overflow: 'hidden',
                }}
              >
                {stage === 'default' && (
                  <button
                    type="button"
                    onClick={handleHeaderClick}
                    aria-pressed={isSelected}
                    className="group relative w-full text-start cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center gap-4 p-4 sm:p-5">
                      <div className="flex flex-col min-w-0 flex-1 gap-2">
                        <span
                          className="font-bold text-base sm:text-[1.0625rem] leading-snug"
                          style={{ color: 'var(--sw-secondary-900)' }}
                        >
                          {name}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {showDuration && displayDuration > 0 && (
                            <DurationChip duration={displayDuration} isAr={isAr} />
                          )}
                          {displayTypes.map((dt) => (
                            <TypeChip key={dt} type={dt} isAr={isAr} />
                          ))}
                        </div>
                      </div>

                      {showPrice && (
                        <div
                          className="flex flex-col items-center justify-center shrink-0 px-4 py-2 rounded-xl"
                          style={{
                            background: isSelected
                              ? 'var(--primary)'
                              : 'color-mix(in srgb, var(--primary) 10%, white)',
                            color: isSelected ? 'var(--primary-foreground)' : 'var(--primary)',
                          }}
                        >
                          <span
                            className="font-bold tabular-nums leading-none text-lg sm:text-xl"
                            style={{ letterSpacing: '-0.02em' }}
                          >
                            {priceLabel}
                          </span>
                          <span className="mt-0.5 text-[0.6875rem] font-semibold" style={{ opacity: 0.85 }}>
                            {t('booking.summary.currency')}
                          </span>
                        </div>
                      )}

                      {isSelected && !hasOptions && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 end-3 grid place-items-center h-5 w-5 rounded-full"
                          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        >
                          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </button>
                )}

                {stage === 'type' && (
                  <div className="flex items-center gap-2 px-3 sm:px-4 pt-9 pb-3 sm:pb-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(null)}
                      aria-label={isAr ? 'إغلاق' : 'Close'}
                      className="shrink-0 grid place-items-center h-9 w-9 rounded-full cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--sw-secondary-700)_8%,transparent)]"
                      style={{ color: 'var(--sw-secondary-700)' }}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                    <span className="text-sm font-bold shrink-0" style={{ color: 'var(--sw-secondary-900)' }}>
                      {isAr ? 'النوع:' : 'Type:'}
                    </span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {displayTypes.map((dt) => {
                        const p = typePalette(dt);
                        return (
                          <button
                            key={dt}
                            type="button"
                            onClick={() => setPickerType(dt)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold cursor-pointer transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                            style={{
                              background: p.bgSoft,
                              color: p.fg,
                              border: `1.5px solid ${p.border}`,
                            }}
                          >
                            {dt === 'ONLINE' ? (
                              <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <rect x="1.5" y="3.5" width="8" height="7" rx="1.2" />
                                <path d="M9.5 6l3-1.5v5L9.5 8z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                <path d="M7 12c-2.5-2.8-4.5-5-4.5-7.2A4.5 4.5 0 1 1 11.5 4.8C11.5 7 9.5 9.2 7 12z" />
                                <circle cx="7" cy="5" r="1.5" />
                              </svg>
                            )}
                            {dt === 'ONLINE' ? (isAr ? 'أونلاين' : 'Online') : isAr ? 'حضوري' : 'In-person'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {stage === 'duration' && (
                  <div className="flex items-center gap-2 px-3 sm:px-4 pt-9 pb-3 sm:pb-4 animate-in fade-in slide-in-from-right-2 duration-200">
                    <button
                      type="button"
                      onClick={() => {
                        if (displayTypes.length > 1) {
                          setPickerType(null);
                        } else {
                          setPickerOpen(null);
                          setPickerType(null);
                        }
                      }}
                      aria-label={isAr ? 'رجوع' : 'Back'}
                      className="shrink-0 grid place-items-center h-9 w-9 rounded-full cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--sw-secondary-700)_8%,transparent)]"
                      style={{ color: 'var(--sw-secondary-700)' }}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4 rtl:scale-x-[-1]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 4l-4 4 4 4" />
                      </svg>
                    </button>
                    <span className="shrink-0">
                      {pickerType && <TypeChip type={pickerType} isAr={isAr} />}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap flex-1 justify-end">
                      {durationsForType.map((c) => {
                        const p = typePalette(c.deliveryType);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onSelect(service, {
                                durationOptionId: c.id,
                                deliveryType: c.deliveryType,
                              });
                              setPickerOpen(null);
                              setPickerType(null);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold tabular-nums cursor-pointer transition-all hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                            style={{
                              background: p.bgSoft,
                              color: p.fg,
                              border: `1.5px solid ${p.border}`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = p.bgSolid;
                              e.currentTarget.style.color = p.fgSolid;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = p.bgSoft;
                              e.currentTarget.style.color = p.fg;
                            }}
                          >
                            <span>
                              {c.durationMins}
                              <span className="text-xs font-semibold opacity-70 ms-0.5">
                                {isAr ? 'د' : 'min'}
                              </span>
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[0.6875rem]"
                              style={{
                                background: 'rgba(255,255,255,0.6)',
                                color: p.fg,
                              }}
                            >
                              {fmt(c.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Header strip showing service name when picker is open */}
                {isOpen && (
                  <div
                    className="absolute top-0 inset-x-0 px-4 py-1.5 text-[0.6875rem] font-bold tracking-wide"
                    style={{
                      background: 'color-mix(in srgb, var(--primary) 10%, white)',
                      color: 'var(--primary)',
                      borderBottom: '1px solid color-mix(in srgb, var(--primary) 18%, transparent)',
                    }}
                  >
                    {name}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DurationChip({ duration, isAr }: { duration: number; isAr: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.75rem] font-semibold tabular-nums leading-none"
      style={{
        background: 'color-mix(in srgb, var(--sw-secondary-700) 7%, transparent)',
        color: 'var(--sw-secondary-900)',
      }}
    >
      <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" />
        <path d="M7 3.5V7l2.2 1.3" strokeLinecap="round" />
      </svg>
      <span>
        {duration} {isAr ? 'د' : 'min'}
      </span>
    </span>
  );
}

// Color palette per delivery type — used by TypeChip, type buttons, duration
// pills, and the per-option price badge.
function typePalette(type: 'IN_PERSON' | 'ONLINE') {
  if (type === 'IN_PERSON') {
    return {
      bgSoft: 'color-mix(in srgb, var(--primary) 12%, white)',
      bgSolid: 'var(--primary)',
      fg: 'var(--primary)',
      fgSolid: 'var(--primary-foreground)',
      border: 'color-mix(in srgb, var(--primary) 28%, transparent)',
    };
  }
  // ONLINE → warm cream/beige palette
  return {
    bgSoft: '#F2E9DA',
    bgSolid: '#A87A3F',
    fg: '#7A5320',
    fgSolid: '#FFFFFF',
    border: '#D9C49C',
  };
}

function TypeChip({ type, isAr }: { type: 'IN_PERSON' | 'ONLINE'; isAr: boolean }) {
  const p = typePalette(type);
  const isOnline = type === 'ONLINE';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[0.75rem] font-semibold leading-none"
      style={{ background: p.bgSoft, color: p.fg }}
    >
      {isOnline ? (
        <>
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="1.5" y="3.5" width="8" height="7" rx="1.2" />
            <path d="M9.5 6l3-1.5v5L9.5 8z" />
          </svg>
          <span>{isAr ? 'أونلاين' : 'Online'}</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M7 12c-2.5-2.8-4.5-5-4.5-7.2A4.5 4.5 0 1 1 11.5 4.8C11.5 7 9.5 9.2 7 12z" />
            <circle cx="7" cy="5" r="1.5" />
          </svg>
          <span>{isAr ? 'حضوري' : 'In-person'}</span>
        </>
      )}
    </span>
  );
}

function CategoryTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="shrink-0 px-4 py-2 text-sm rounded-full transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sw-cream)]"
      style={{
        background: active ? 'var(--primary)' : 'white',
        color: active ? 'var(--primary-foreground)' : 'var(--sw-secondary-700)',
        fontWeight: active ? 700 : 600,
        border: active
          ? '1.5px solid var(--primary)'
          : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
      }}
    >
      {label}
    </button>
  );
}
