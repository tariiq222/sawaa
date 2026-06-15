'use client';

import type { EmployeeWithUser } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';
import Image from 'next/image';
import { safeImageSrc } from '@/lib/image-url';
import { therapistDisplayName, initialsFromName } from './therapist-name';

interface TherapistPickerProps {
  therapists: EmployeeWithUser[];
  selected: EmployeeWithUser | null;
  onSelect: (employee: EmployeeWithUser) => void;
}


export function TherapistPicker({ therapists, selected, onSelect }: TherapistPickerProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';

  const valid = therapists.filter((emp) => emp.user);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-[1.625rem] sm:text-[1.75rem] font-extrabold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.015em' }}
        >
          {t('booking.selectTherapist')}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-body)' }}
        >
          {isAr
            ? 'كل المعالجين معتمدون ومدرّبون. اقرأ تخصّصهم واختر الأنسب لحالتك.'
            : 'Every therapist is certified and trained. Read their specialty and pick who feels right.'}
        </p>
      </header>

      {valid.length === 0 ? (
        <TherapistEmptyState isAr={isAr} />
      ) : (
        <ul
          className={`grid gap-3 ${valid.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
          role="list"
        >
          {valid.map((emp) => {
            const isSelected = selected?.id === emp.id;
            const fullName = therapistDisplayName(emp, isAr) || (isAr ? 'معالج' : 'Therapist');
            const specialty = isAr
              ? emp.specialtyAr ?? emp.specialty ?? null
              : emp.specialty ?? emp.specialtyAr ?? null;
            const hasRating = emp.rating > 0 && emp.reviewCount > 0;

            return (
              <li key={emp.id}>
                <button
                  type="button"
                  onClick={() => onSelect(emp)}
                  aria-pressed={isSelected}
                  className="group relative w-full h-full text-start cursor-pointer rounded-[1.25rem] bg-white transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                  style={{
                    border: isSelected
                      ? '1.5px solid var(--primary)'
                      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
                    boxShadow: isSelected ? 'var(--sw-shadow-md)' : 'var(--sw-shadow-xs)',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--primary) 5%, #FFFFFF)'
                      : '#FFFFFF',
                  }}
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--primary) 55%, transparent)';
                    e.currentTarget.style.boxShadow = 'var(--sw-shadow-md)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) return;
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)';
                    e.currentTarget.style.boxShadow = 'var(--sw-shadow-xs)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-4 p-4">
                    <Avatar
                      name={fullName}
                      avatarUrl={emp.user.avatarUrl}
                      initials={initialsFromName(fullName)}
                    />

                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                      <span
                        className="font-bold text-[0.9375rem] leading-tight truncate"
                        style={{ color: 'var(--sw-secondary-700)' }}
                      >
                        {fullName}
                      </span>

                      {specialty && (
                        <span
                          className="text-[0.8125rem] font-semibold leading-snug line-clamp-2"
                          style={{ color: 'var(--primary-dark)' }}
                        >
                          {specialty}
                        </span>
                      )}

                      {(hasRating || emp.experience > 0) && (
                        <span
                          className="flex items-center gap-2 mt-1 text-xs tabular-nums font-medium"
                          style={{ color: 'var(--sw-body)' }}
                        >
                          {hasRating && (
                            <span className="inline-flex items-center gap-1">
                              <StarIcon />
                              <span className="font-bold" style={{ color: 'var(--sw-secondary-700)' }}>
                                {emp.rating.toFixed(1)}
                              </span>
                            </span>
                          )}
                          {hasRating && emp.experience > 0 && <Dot />}
                          {emp.experience > 0 && (
                            <span>
                              {emp.experience}+ {isAr ? 'سنة خبرة' : 'yrs exp'}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <span
                      aria-hidden="true"
                      className="grid place-items-center h-8 w-8 shrink-0 rounded-full transition-all duration-200 group-hover:bg-[var(--primary)] group-hover:text-white"
                      style={{
                        background: isSelected
                          ? 'var(--primary)'
                          : 'color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)',
                        color: isSelected ? '#FFFFFF' : 'var(--sw-secondary-700)',
                      }}
                    >
                      {isSelected ? (
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" className="h-4 w-4 -scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Avatar({
  name,
  avatarUrl,
  initials,
}: {
  name: string;
  avatarUrl: string | null;
  initials: string;
}) {
  const safeSrc = safeImageSrc(avatarUrl);
  if (safeSrc) {
    return (
      <Image
        src={safeSrc}
        alt=""
        width={64}
        height={64}
        unoptimized
        className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full object-cover"
        style={{
          background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
          boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 3.5px color-mix(in srgb, var(--primary) 30%, transparent)',
        }}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full font-bold text-base sm:text-lg"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, #FFFFFF), color-mix(in srgb, var(--primary) 7%, #FFFFFF))',
        color: 'var(--primary-dark)',
        boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 3.5px color-mix(in srgb, var(--primary) 25%, transparent)',
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: 'var(--accent-dark)' }}
    >
      <path d="M6 1.2l1.45 2.94 3.25.47-2.35 2.29.55 3.23L6 8.6 3.1 10.13l.55-3.23-2.35-2.29 3.25-.47z" />
    </svg>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block rounded-full"
      style={{ width: 3, height: 3, background: 'currentColor', opacity: 0.4 }}
    />
  );
}

function TherapistEmptyState({ isAr }: { isAr: boolean }) {
  return (
    <div
      className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-2xl"
      style={{
        background: 'color-mix(in srgb, var(--primary) 4%, #FFFFFF)',
        border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 16%, transparent)',
      }}
    >
      <span
        aria-hidden="true"
        className="grid place-items-center h-12 w-12 rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          color: 'var(--primary-dark)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-3.5 3.6-6 7-6s6.3 2.5 7 6" />
        </svg>
      </span>
      <p
        className="text-sm font-bold"
        style={{ color: 'var(--sw-secondary-700)' }}
      >
        {isAr ? 'لا يوجد معالجون متاحون حالياً' : 'No therapists available right now'}
      </p>
      <p
        className="text-xs max-w-[44ch] leading-relaxed"
        style={{ color: 'var(--sw-body)' }}
      >
        {isAr
          ? 'جدول المعالجين قد يكون قيد التحديث. تواصل معنا مباشرة وراح نرتّب لك موعد.'
          : 'Our schedule may be updating. Reach out and we will arrange an appointment for you.'}
      </p>
      <a
        href="/contact"
        className="mt-1 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.99]"
        style={{
          background: 'var(--primary)',
          color: '#FFFFFF',
          boxShadow: 'var(--sw-shadow-primary)',
        }}
      >
        {isAr ? 'تواصل معنا' : 'Contact us'}
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 -scale-x-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
      </a>
    </div>
  );
}
