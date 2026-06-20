'use client';

import { useMemo, useState } from 'react';
import type { Service } from '@sawaa/shared';
import { grossWithVat, halalasToSarNumber } from '@/lib/money';
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
  /**
   * Fractional org VAT rate (0.15 = 15%). Display-only: prices are shown
   * VAT-inclusive with an "incl. VAT" label when > 0.
   */
  vatRate?: number;
  /**
   * When true, clicking a service card immediately selects it without the
   * inline delivery/duration picker. Used in service-first flow where
   * practitioner options replace the service-level choices.
   */
  skipChoicePicker?: boolean;
}

type Choice = {
  id: string;
  deliveryType: 'IN_PERSON' | 'ONLINE';
  durationMins: number;
  price: number;
  label?: string;
};

export function ServicePicker({
  services,
  categories,
  selected,
  onSelect,
  lockedTherapistName,
  onClearLockedTherapist,
  initialCategoryId = null,
  vatRate = 0,
  skipChoicePicker = false,
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

  const fmt = (halalas: number) =>
    Intl.NumberFormat(isAr ? 'ar-SA' : 'en-US', {
      style: 'decimal',
      maximumFractionDigits: 2,
    }).format(halalasToSarNumber(grossWithVat(halalas, vatRate)));

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
          const showPrice = service.showPrice ?? true;
          const showDuration = service.showDuration ?? true;

          // Build the list of choices: prefer durationOptions when present,
          // otherwise fall back to bookingConfigs (one row per delivery type).
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
          const priceLabel =
            minPrice === maxPrice
              ? fmt(minPrice)
              : `${isAr ? 'من' : 'from'} ${fmt(minPrice)}`;

          const singleChoice = choices.length === 1 ? choices[0] : null;
          const displayDuration = singleChoice?.durationMins ?? fallbackDuration;
          // Delivery types come from bookingConfigs — durationOptions are
          // delivery-agnostic duration/price tiers and carry no deliveryType,
          // so deriving from `choices` yields [null] when options are present.
          const usesDurationOptions = durationOpts.length > 0;
          const deliveryTypeSource = configs.length > 0 ? configs : choices;
          const displayTypes: Array<'IN_PERSON' | 'ONLINE'> = Array.from(
            new Set(
              deliveryTypeSource
                .map((c) => c.deliveryType)
                .filter((d): d is 'IN_PERSON' | 'ONLINE' => d === 'IN_PERSON' || d === 'ONLINE'),
            ),
          );

          const isOpen = pickerOpen === service.id;
          const stage: 'type' | 'duration' = pickerType ? 'duration' : 'type';

          const handleHeaderClick = () => {
            if (skipChoicePicker) {
              onSelect(service);
              return;
            }
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

          // durationOptions are delivery-agnostic → show every tier once a type
          // is chosen. bookingConfig-based choices stay filtered by delivery type.
          const durationsForType = pickerType
            ? (usesDurationOptions
                ? [...choices]
                : choices.filter((c) => c.deliveryType === pickerType)
              ).sort((a, b) => a.durationMins - b.durationMins)
            : [];

          return (
            <li key={service.id}>
              <div
                className="rounded-[1.25rem] bg-white transition-all duration-200"
                style={{
                  border:
                    isSelected || isOpen
                      ? '1.5px solid var(--primary)'
                      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
                  boxShadow: isSelected || isOpen ? 'var(--sw-shadow-md)' : 'var(--sw-shadow-xs)',
                }}
              >
                <button
                  type="button"
                  onClick={handleHeaderClick}
                  aria-pressed={isSelected}
                  aria-expanded={hasOptions ? isOpen : undefined}
                  className="group w-full text-start cursor-pointer rounded-[1.25rem] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                  onMouseEnter={(e) => {
                    if (isSelected || isOpen) return;
                    const card = e.currentTarget.parentElement!;
                    card.style.borderColor = 'color-mix(in srgb, var(--primary) 55%, transparent)';
                    card.style.boxShadow = 'var(--sw-shadow-md)';
                    card.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected || isOpen) return;
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
                      <span
                        className="flex items-center gap-2 flex-wrap text-[0.8125rem] font-medium"
                        style={{ color: 'var(--sw-body)' }}
                      >
                        {showDuration && displayDuration > 0 && (
                          <MetaItem icon="clock" text={`${displayDuration} ${isAr ? 'دقيقة' : 'min'}`} numeric />
                        )}
                        {displayTypes.map((dt) => (
                          <MetaItem
                            key={dt}
                            icon={dt === 'ONLINE' ? 'video' : 'pin'}
                            text={dt === 'ONLINE' ? (isAr ? 'أونلاين' : 'Online') : isAr ? 'حضوري' : 'In-person'}
                          />
                        ))}
                        {hasOptions && (
                          <span
                            className="text-xs font-semibold"
                            style={{ color: 'var(--primary-dark)' }}
                          >
                            {isAr ? `${choices.length} خيارات` : `${choices.length} options`}
                          </span>
                        )}
                      </span>
                    </div>

                    {showPrice && (
                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <span className="flex items-baseline gap-1">
                          <span
                            className="font-extrabold tabular-nums leading-none text-xl sm:text-[1.375rem]"
                            style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.02em' }}
                          >
                            {priceLabel}
                          </span>
                          <span
                            className="text-[0.6875rem] font-semibold"
                            style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 50%, transparent)' }}
                          >
                            {t('booking.summary.currency')}
                          </span>
                        </span>
                        {vatRate > 0 && (
                          <span
                            className="text-[0.625rem] font-medium"
                            style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 45%, transparent)' }}
                          >
                            {t('booking.price.inclVat')}
                          </span>
                        )}
                      </div>
                    )}

                    <span
                      aria-hidden="true"
                      className="grid place-items-center h-8 w-8 shrink-0 rounded-full transition-all duration-200 group-hover:bg-[var(--primary)] group-hover:text-white"
                      style={{
                        background: isOpen
                          ? 'var(--primary)'
                          : 'color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)',
                        color: isOpen ? '#FFFFFF' : 'var(--sw-secondary-700)',
                      }}
                    >
                      {hasOptions ? (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-4 w-4 transition-transform duration-200"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" className="h-4 w-4 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>

                {hasOptions && (
                  <div className="sw-expand" data-open={isOpen}>
                    <div>
                      <div
                        className="flex flex-col gap-3 px-4 sm:px-5 pb-4 sm:pb-5 pt-4"
                        style={{
                          borderTop: '1px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)',
                        }}
                      >
                        {stage === 'type' ? (
                          <>
                            <span
                              className="text-xs font-bold"
                              style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
                            >
                              {isAr ? 'كيف تفضّل الجلسة؟' : 'How would you like to attend?'}
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              {displayTypes.map((dt) => (
                                <button
                                  key={dt}
                                  type="button"
                                  onClick={() => setPickerType(dt)}
                                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                                  style={{
                                    background: 'color-mix(in srgb, var(--primary) 7%, #FFFFFF)',
                                    color: 'var(--primary-dark)',
                                    border: '1.5px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--primary)';
                                    e.currentTarget.style.color = '#FFFFFF';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                      'color-mix(in srgb, var(--primary) 7%, #FFFFFF)';
                                    e.currentTarget.style.color = 'var(--primary-dark)';
                                  }}
                                >
                                  {dt === 'ONLINE' ? (
                                    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                      <rect x="1.5" y="3.5" width="8" height="7" rx="1.2" />
                                      <path d="M9.5 6l3-1.5v5L9.5 8z" />
                                    </svg>
                                  ) : (
                                    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                                      <path d="M7 12c-2.5-2.8-4.5-5-4.5-7.2A4.5 4.5 0 1 1 11.5 4.8C11.5 7 9.5 9.2 7 12z" />
                                      <circle cx="7" cy="5" r="1.5" />
                                    </svg>
                                  )}
                                  {dt === 'ONLINE' ? (isAr ? 'أونلاين' : 'Online') : isAr ? 'حضوري' : 'In-person'}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="text-xs font-bold"
                                style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 60%, transparent)' }}
                              >
                                {isAr ? 'اختر مدة الجلسة' : 'Pick a session length'}
                              </span>
                              {displayTypes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setPickerType(null)}
                                  className="text-xs font-bold rounded-full px-2.5 py-1 cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                                  style={{ color: 'var(--primary-dark)' }}
                                >
                                  {pickerType === 'ONLINE'
                                    ? isAr ? 'أونلاين · تغيير' : 'Online · change'
                                    : isAr ? 'حضوري · تغيير' : 'In-person · change'}
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {durationsForType.map((c) => (
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
                                  className="flex items-baseline gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-150 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                                  style={{
                                    background: 'color-mix(in srgb, var(--primary) 7%, #FFFFFF)',
                                    border: '1.5px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                                    color: 'var(--primary-dark)',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--primary)';
                                    e.currentTarget.style.color = '#FFFFFF';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                      'color-mix(in srgb, var(--primary) 7%, #FFFFFF)';
                                    e.currentTarget.style.color = 'var(--primary-dark)';
                                  }}
                                >
                                  <span className="text-sm font-extrabold tabular-nums">
                                    {c.durationMins}
                                    <span className="text-xs font-semibold opacity-75 ms-1">
                                      {isAr ? 'دقيقة' : 'min'}
                                    </span>
                                  </span>
                                  <span className="text-xs font-bold tabular-nums opacity-85">
                                    {fmt(c.price)} {t('booking.summary.currency')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
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

function MetaItem({
  icon,
  text,
  numeric = false,
}: {
  icon: 'clock' | 'video' | 'pin';
  text: string;
  numeric?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${numeric ? 'tabular-nums' : ''}`}>
      {icon === 'clock' && (
        <svg viewBox="0 0 14 14" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" />
          <path d="M7 3.5V7l2.2 1.3" strokeLinecap="round" />
        </svg>
      )}
      {icon === 'video' && (
        <svg viewBox="0 0 14 14" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="1.5" y="3.5" width="8" height="7" rx="1.2" />
          <path d="M9.5 6l3-1.5v5L9.5 8z" />
        </svg>
      )}
      {icon === 'pin' && (
        <svg viewBox="0 0 14 14" className="h-3 w-3 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M7 12c-2.5-2.8-4.5-5-4.5-7.2A4.5 4.5 0 1 1 11.5 4.8C11.5 7 9.5 9.2 7 12z" />
          <circle cx="7" cy="5" r="1.5" />
        </svg>
      )}
      {text}
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
