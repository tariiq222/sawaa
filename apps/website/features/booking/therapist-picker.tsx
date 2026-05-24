'use client';

import type { EmployeeWithUser } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';

interface TherapistPickerProps {
  therapists: EmployeeWithUser[];
  selected: EmployeeWithUser | null;
  onSelect: (employee: EmployeeWithUser) => void;
}

function initialsOf(first: string, last: string): string {
  const f = (first || '').trim().charAt(0);
  const l = (last || '').trim().charAt(0);
  return (f + l).toUpperCase() || '—';
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
          className="text-2xl sm:text-[1.625rem] font-bold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-900)', letterSpacing: '-0.015em' }}
        >
          {t('booking.selectTherapist')}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-secondary-500)' }}
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
          className={`grid gap-3 sm:gap-4 ${valid.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
          role="list"
        >
          {valid.map((emp) => {
            const isSelected = selected?.id === emp.id;
            const fullName =
              `${emp.user.firstName ?? ''} ${emp.user.lastName ?? ''}`.trim() ||
              (isAr ? 'معالج' : 'Therapist');
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
                  className="group relative w-full text-start cursor-pointer rounded-2xl bg-white transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sw-cream)]"
                  style={{
                    border: isSelected
                      ? '1.5px solid var(--primary)'
                      : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
                    boxShadow: isSelected
                      ? 'var(--sw-shadow-primary)'
                      : 'var(--sw-shadow-xs)',
                    background: isSelected
                      ? 'color-mix(in srgb, var(--primary) 6%, white)'
                      : 'white',
                  }}
                  onMouseEnter={(e) => {
                    if (isSelected) return;
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background =
                      'color-mix(in srgb, var(--primary) 5%, white)';
                    e.currentTarget.style.boxShadow = 'var(--sw-shadow-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    if (isSelected) return;
                    e.currentTarget.style.borderColor =
                      'color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.boxShadow = 'var(--sw-shadow-xs)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-4 p-4 sm:p-5">
                    <Avatar
                      name={fullName}
                      avatarUrl={emp.user.avatarUrl}
                      initials={initialsOf(emp.user.firstName, emp.user.lastName)}
                    />

                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                      <span
                        className="font-bold text-base leading-tight truncate"
                        style={{ color: 'var(--sw-secondary-900)' }}
                      >
                        {fullName}
                      </span>

                      {specialty && (
                        <span
                          className="text-[0.8125rem] font-medium leading-snug line-clamp-2"
                          style={{ color: 'var(--primary)' }}
                        >
                          {specialty}
                        </span>
                      )}

                      <div
                        className="flex items-center gap-2 mt-1 text-[0.6875rem] tabular-nums font-medium"
                        style={{ color: 'var(--sw-secondary-500)' }}
                      >
                        {hasRating && (
                          <>
                            <span className="inline-flex items-center gap-0.5">
                              <StarIcon />
                              <span
                                className="font-bold"
                                style={{ color: 'var(--sw-secondary-900)' }}
                              >
                                {emp.rating.toFixed(1)}
                              </span>
                            </span>
                            {emp.experience > 0 && <Dot />}
                          </>
                        )}
                        {emp.experience > 0 && (
                          <span>
                            {emp.experience}+ {isAr ? 'سنة خبرة' : 'yrs exp'}
                          </span>
                        )}
                      </div>
                    </div>

                    <SelectionIndicator isSelected={isSelected} />
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
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full object-cover"
        style={{
          background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
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
      className="grid place-items-center h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full font-bold text-base sm:text-lg tabular-nums"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, white), color-mix(in srgb, var(--primary) 6%, white))',
        color: 'var(--primary)',
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

function SelectionIndicator({ isSelected }: { isSelected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center shrink-0 rounded-full transition-all duration-150"
      style={{
        width: 22,
        height: 22,
        background: isSelected ? 'var(--primary)' : 'transparent',
        border: isSelected
          ? '2px solid var(--primary)'
          : '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 22%, transparent)',
        color: 'var(--primary-foreground)',
      }}
    >
      {isSelected && (
        <svg
          viewBox="0 0 12 12"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
        </svg>
      )}
    </span>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: 'var(--primary)' }}
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
        background: 'color-mix(in srgb, var(--primary) 4%, var(--sw-cream))',
        border: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 14%, transparent)',
      }}
    >
      <span
        aria-hidden="true"
        className="grid place-items-center h-12 w-12 rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          color: 'var(--primary)',
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
        className="text-sm font-semibold"
        style={{ color: 'var(--sw-secondary-900)' }}
      >
        {isAr ? 'لا يوجد معالجون متاحون حالياً' : 'No therapists available right now'}
      </p>
      <p
        className="text-xs max-w-[44ch] leading-relaxed"
        style={{ color: 'var(--sw-secondary-500)' }}
      >
        {isAr
          ? 'جدول المعالجين قد يكون قيد التحديث. تواصل معنا مباشرة وراح نرتّب لك موعد.'
          : 'Our schedule may be updating. Reach out and we will arrange an appointment for you.'}
      </p>
      <a
        href="/contact"
        className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors"
        style={{
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
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
