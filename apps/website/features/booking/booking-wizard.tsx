'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ServicePicker } from '@/features/booking/service-picker';
import { TherapistPicker } from '@/features/booking/therapist-picker';
import { SlotPicker } from '@/features/booking/slot-picker';
import { BranchStep } from '@/features/booking/branch-step';
import { ClientInfoStep } from '@/features/booking/client-info-step';
import { DateStrip } from '@/features/booking/date-strip';
import { grossWithVat, halalasToSarNumber } from '@/lib/money';
import { PaymentRedirect } from '@/features/payment/payment-redirect';
import { BookingSkeleton } from '@/features/booking/booking-skeleton';
import { SummaryRail, SummaryChips } from '@/features/booking/summary-rail';
import { useT, useLocale } from '@/features/locale/locale-provider';
import { SITE } from '@/themes/sawaa/lib/constants';
import type { PractitionerBookingOption } from '@/features/booking/booking.api';
import { useBookingWizard } from '@/features/booking/use-booking-wizard';
import '@/themes/sawaa/theme.css';

function IconButton({
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

function ProgressBar({ current, labels }: { current: number; labels: string[] }) {
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

function PractitionerChoicePicker({
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

function BookingWizardInner() {
  const w = useBookingWizard();

  if (w.readyToRedirect && w.redirectUrl && w.bookingId) {
    return (
      <div className="theme-sawaa">
        <PaymentRedirect redirectUrl={w.redirectUrl} bookingId={w.bookingId} />
      </div>
    );
  }

  return (
    <div className="theme-sawaa">
      <div className="sw-section-mint min-h-screen">
        <div className="mx-auto w-full max-w-[1024px] px-4 sm:px-6 pt-6 sm:pt-8 pb-16">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <div className="flex items-center gap-2">
              <IconButton onClick={w.handleClose} ariaLabel="إغلاق">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </IconButton>
              {w.canStepBack && (
                <IconButton onClick={w.handleStepBack} ariaLabel={w.t('booking.back')}>
                  <svg viewBox="0 0 16 16" className="h-4 w-4 rtl:scale-x-[-1]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 4l-4 4 4 4" />
                    <path d="M6 8h8" />
                  </svg>
                </IconButton>
              )}
            </div>
            <Image
              src={SITE.logo}
              alt={w.isAr ? SITE.name : SITE.nameEn}
              width={36}
              height={36}
              priority={false}
              className="shrink-0 object-contain"
            />
          </div>

          <div
            className={
              w.showSummary
                ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10 lg:items-start'
                : ''
            }
          >
            <div
              className={
                w.showSummary
                  ? 'mx-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none'
                  : 'mx-auto w-full max-w-[640px]'
              }
            >
              {!w.nothingBookable && !w.isConfirmation && (
                <ProgressBar current={w.stepIndex} labels={w.stepLabels} />
              )}

              {(w.loadError || w.submitError) && (
                <div
                  role="alert"
                  className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm bg-[var(--surface)]"
                  style={{
                    color: 'var(--error)',
                    border: '1px solid color-mix(in srgb, var(--error) 25%, transparent)',
                    boxShadow: 'var(--sw-shadow-xs)',
                  }}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.5" />
                    <path d="M8 5v3.5M8 10.5v.5" strokeLinecap="round" />
                  </svg>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-medium">
                      {w.loadError ? w.t('account.loadError') : w.submitError}
                    </span>
                    {w.submitError && w.paymentRecovery && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link
                          href={`/account/bookings/${w.paymentRecovery.bookingId}`}
                          className="font-bold underline underline-offset-2"
                        >
                          {w.t('booking.viewExistingBooking')}
                        </Link>
                        <button
                          type="button"
                          onClick={w.handleStartOverFromRecovery}
                          className="font-bold underline underline-offset-2"
                        >
                          {w.t('booking.bookAnother')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {w.showSummary && (
                <div className="mb-5">
                  <SummaryChips {...w.summaryProps} />
                </div>
              )}

              <div key={w.screenKey} className="sw-step-in">
                {w.nothingBookable && (
                  <div
                    className="flex flex-col items-center text-center gap-4 px-6 py-14 rounded-[1.25rem] bg-[var(--surface)]"
                    style={{
                      border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 18%, transparent)',
                      boxShadow: 'var(--sw-shadow-xs)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="sw-pop-in grid place-items-center h-14 w-14 rounded-full"
                      style={{
                        background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                        color: 'var(--primary-dark)',
                      }}
                    >
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                      </svg>
                    </span>
                    <h2 className="text-lg font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
                      {w.t('booking.unavailable.title')}
                    </h2>
                    <p
                      className="text-sm leading-relaxed max-w-[44ch]"
                      style={{ color: 'var(--sw-body)' }}
                    >
                      {w.t('booking.unavailable.body')}
                    </p>
                    <a
                      href="/contact"
                      className="mt-2 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.99]"
                      style={{
                        background: 'var(--primary)',
                        color: 'var(--on-primary)',
                        boxShadow: 'var(--sw-shadow-primary)',
                      }}
                    >
                      {w.t('booking.unavailable.cta')}
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    </a>
                  </div>
                )}

                {!w.nothingBookable && w.currentScreen === 'branch' && (
                  <BranchStep
                    branches={w.branchStepBranches}
                    onSelect={w.handleBranchSelect}
                    onBack={w.handleBranchCancel}
                  />
                )}

                {!w.nothingBookable && w.currentScreen === 'service' && (
                  w.loadingData ? (
                    <BookingSkeleton count={4} />
                  ) : (
                    <div className="flex flex-col gap-5">
                      <ServicePicker
                        services={w.filteredServices}
                        categories={w.categories}
                        selected={null}
                        onSelect={w.handleServiceSelect}
                        lockedTherapistName={w.entryPoint === 'therapist' ? w.lockedTherapistName : null}
                        onClearLockedTherapist={
                          w.entryPoint === 'therapist'
                            ? w.handleClearLockedEmployee
                            : undefined
                        }
                        initialCategoryId={w.preselectCategoryId}
                      />
                    </div>
                  )
                )}

                {!w.nothingBookable && w.currentScreen === 'therapist' && (
                  <div className="flex flex-col gap-5">
                    {w.loadingData ? (
                      <BookingSkeleton count={4} />
                    ) : (
                      <TherapistPicker
                        therapists={w.filteredTherapists}
                        selected={null}
                        onSelect={w.handleTherapistSelect}
                      />
                    )}
                  </div>
                )}

                {!w.nothingBookable && w.currentScreen === 'choice' && w.service && w.employee && (
                  <PractitionerChoicePicker
                    options={w.practitionerOptions?.options ?? []}
                    isLoading={w.practitionerOptionsLoading}
                    isAr={w.isAr}
                    vatRate={w.vatRate}
                    onSelect={w.handleChoiceConfirm}
                    t={w.t}
                  />
                )}

                {!w.nothingBookable && w.currentScreen === 'slot' && w.service && w.employee && (
                  <div className="flex flex-col gap-6">
                    <DateStrip
                      value={w.selectedDate}
                      onChange={w.handleSetDate}
                      allowedDaysOfWeek={w.employee.availableDaysOfWeek}
                      bookableDates={w.bookableDates}
                    />
                    <SlotPicker
                      slots={w.slots}
                      selected={null}
                      onSelect={w.handleSelectSlot}
                      isLoading={w.loadingSlots}
                    />
                  </div>
                )}

                {!w.nothingBookable && w.currentScreen === 'info' && w.service && w.employee && w.slot && (
                  <ClientInfoStep
                    slot={w.slot}
                    service={w.service}
                    employee={w.employee}
                    vatRate={w.vatRate}
                    selectedPriceHalalas={w.selectedPriceHalalas}
                    onBack={w.handleBackFromInfo}
                    onSubmitInfo={w.handleSubmitInfo}
                    isSubmitting={w.isSubmitting}
                  />
                )}

                {w.isConfirmation && (
                  <div className="text-center py-12 px-4 flex flex-col items-center gap-5">
                    {w.confirmationSucceeded ? (
                      <>
                        <div
                          className="sw-pop-in inline-flex h-16 w-16 items-center justify-center rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--primary) 14%, var(--surface))',
                            color: 'var(--primary-dark)',
                            boxShadow: '0 0 0 8px color-mix(in srgb, var(--primary) 6%, transparent)',
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5 9.5-10" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--sw-secondary-700)' }}>
                          {w.t('booking.confirmed')}
                        </h2>
                        <p className="text-sm max-w-[42ch] leading-relaxed" style={{ color: 'var(--sw-body)' }}>
                          {w.t('booking.confirmedDesc')}
                        </p>
                      </>
                    ) : (
                      <>
                        <div
                          className="sw-pop-in inline-flex h-16 w-16 items-center justify-center rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--error) 10%, var(--surface))',
                            color: 'var(--error)',
                            boxShadow: '0 0 0 8px color-mix(in srgb, var(--error) 5%, transparent)',
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M7 7l10 10M17 7L7 17" />
                          </svg>
                        </div>
                        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--sw-secondary-700)' }}>
                          {w.t('booking.paymentFailed')}
                        </h2>
                        <p className="text-sm max-w-[42ch] leading-relaxed" style={{ color: 'var(--sw-body)' }}>
                          {w.t('booking.paymentFailedDesc')}
                        </p>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={w.handleBookAnother}
                      className="mt-2 inline-flex items-center justify-center px-7 py-3 rounded-full text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
                      style={{
                        background: 'var(--primary)',
                        color: 'var(--on-primary)',
                        boxShadow: 'var(--sw-shadow-primary)',
                      }}
                    >
                      {w.confirmationSucceeded
                        ? w.t('booking.bookAnother')
                        : w.t('booking.tryAgain')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {w.showSummary && (
              <div className="hidden lg:block">
                <SummaryRail {...w.summaryProps} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-sawaa">
          <div className="sw-section-mint min-h-screen">
            <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-8 sm:pt-12 pb-16">
              <BookingSkeleton count={4} />
            </div>
          </div>
        </div>
      }
    >
      <BookingWizardInner />
    </Suspense>
  );
}
