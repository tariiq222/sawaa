'use client';

import { useMemo, useState } from 'react';
import type { PublicEmployee } from '@sawaa/api-client';
import { TherapistCardSawaa } from './therapist-card';

export interface TherapistsGridLabels {
  filterAll: string;
  viewProfile: string;
  noBio: string;
  empty: string;
}

interface Props {
  therapists: PublicEmployee[];
  locale: 'ar' | 'en';
  labels: TherapistsGridLabels;
  initialSpecialty?: string | null;
}

function specialtyOf(e: PublicEmployee, locale: 'ar' | 'en'): string | null {
  const raw = locale === 'ar' ? e.specialtyAr : e.specialty;
  const value = raw?.trim();
  return value && value.length > 0 ? value : null;
}

function normalize(s: string): string {
  return s.trim().toLocaleLowerCase();
}

export function TherapistsGrid({ therapists, locale, labels, initialSpecialty = null }: Props) {
  const specialties = useMemo(() => {
    const set = new Set<string>();
    for (const e of therapists) {
      const s = specialtyOf(e, locale);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, locale));
  }, [therapists, locale]);

  // Map an external hint (e.g. from /clinics → /therapists?specialty=)
  // to an actual chip value by case-insensitive match.
  const initialMatch = useMemo(() => {
    if (!initialSpecialty) return null;
    const target = normalize(initialSpecialty);
    return specialties.find((s) => normalize(s) === target) ?? null;
  }, [initialSpecialty, specialties]);

  const [active, setActive] = useState<string | null>(initialMatch);

  const filtered = useMemo(() => {
    if (!active) return therapists;
    return therapists.filter((e) => specialtyOf(e, locale) === active);
  }, [therapists, active, locale]);

  if (therapists.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="text-center max-w-md mx-auto py-12 px-8 rounded-[24px] bg-white"
          style={{
            border: '1px solid color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)',
            boxShadow: 'var(--sw-shadow-xs)',
          }}
        >
          <h3
            className="text-[1.0625rem] font-semibold mb-2"
            style={{ color: 'var(--sw-secondary-700)' }}
          >
            {labels.empty}
          </h3>
        </div>
      </div>
    );
  }

  return (
    <>
      {specialties.length > 1 ? (
        <div className="relative mb-10 -mx-5 sm:-mx-6 md:mx-0">
          <div className="flex gap-2 overflow-x-auto sw-no-scrollbar px-5 sm:px-6 md:px-0 md:flex-wrap">
            <FilterChip
              label={labels.filterAll}
              count={therapists.length}
              active={active === null}
              onClick={() => setActive(null)}
            />
            {specialties.map((s) => {
              const count = therapists.filter((e) => specialtyOf(e, locale) === s).length;
              return (
                <FilterChip
                  key={s}
                  label={s}
                  count={count}
                  active={active === s}
                  onClick={() => setActive(s)}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
        {filtered.map((therapist) => (
          <TherapistCardSawaa
            key={therapist.id}
            therapist={therapist}
            locale={locale}
            labels={{ viewProfile: labels.viewProfile, noBio: labels.noBio }}
          />
        ))}
      </div>
    </>
  );
}

interface ChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FilterChip({ label, count, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[0.8125rem] font-medium transition-all duration-200"
      style={
        active
          ? {
              background: 'var(--sw-secondary-700)',
              color: '#fff',
              boxShadow: '0 1px 2px rgba(10, 46, 63, 0.08)',
            }
          : {
              background: '#fff',
              color: 'var(--sw-secondary-700)',
              border: '1px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)',
            }
      }
    >
      <span>{label}</span>
      <span
        className="tabular-nums text-[0.6875rem] font-semibold opacity-70"
        style={{
          color: active ? 'rgba(255,255,255,0.85)' : 'var(--sw-neutral-500)',
        }}
      >
        {count}
      </span>
    </button>
  );
}
