'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { PublicEmployee } from '@sawaa/api-client';
import { therapistPortraitSrc } from './portrait-src';

export interface TherapistCardLabels {
  viewProfile: string;
}

interface Props {
  therapist: PublicEmployee;
  locale: 'ar' | 'en';
  labels: TherapistCardLabels;
}

function initials(name: string | null | undefined): string {
  if (!name) return '·';
  const cleaned = name.replace(/^(د\.|أ\.|Dr\.)\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0)).join('') || '·';
}

// The 3:2 portraits need 1.5 times the square slot's width to cover its height.
const PORTRAIT_SIZES = '(min-width: 1280px) 400px, (min-width: 768px) calc(37.5vw - 46px), (min-width: 640px) calc(50vw - 40px), calc(75vw - 42px)';

export function TherapistCardSawaa({ therapist, locale, labels }: Props) {
  const name = (locale === 'ar' ? therapist.nameAr : therapist.nameEn) ?? therapist.nameAr ?? '—';
  const role = (locale === 'ar' ? therapist.specialtyAr : therapist.specialty) ?? therapist.title ?? '';
  const portraitSrc = therapistPortraitSrc(therapist);
  const href = therapist.slug ? `/therapists/${therapist.slug}` : '/therapists';

  return (
    <Link
      href={href}
      aria-label={`${labels.viewProfile} — ${name}`}
      className="group relative flex flex-col h-full rounded-[16px] bg-[var(--surface)] overflow-hidden transition-all duration-300 hover:-translate-y-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sw-cream)]"
      style={{
        border: '1px solid color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)',
        boxShadow: 'var(--sw-shadow-xs)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 28%, transparent)';
        e.currentTarget.style.boxShadow = 'var(--sw-shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--sw-secondary-700) 6%, transparent)';
        e.currentTarget.style.boxShadow = 'var(--sw-shadow-xs)';
      }}
    >
      <article className="flex flex-col h-full">
        {/* Portrait area — square-ish, compact */}
        <div className="relative aspect-square w-full overflow-hidden bg-[color:var(--sw-primary-50)]">
          {portraitSrc ? (
            <Image
              src={portraitSrc}
              alt=""
              fill
              sizes={PORTRAIT_SIZES}
              className="object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[2.25rem] font-light"
                style={{
                  color: 'color-mix(in srgb, var(--sw-primary-600) 55%, white)',
                  letterSpacing: '-0.04em',
                }}
              >
                {initials(name)}
              </span>
            </div>
          )}
        </div>

        {/* Text block */}
        <div className="flex flex-col flex-1 px-4 pt-4 pb-4 gap-2">
          <header className="flex flex-col gap-0.5">
            <h3
              className="text-[0.9375rem] leading-snug font-semibold tracking-tight line-clamp-1"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {name}
            </h3>
            {role ? (
              <p
                className="text-[0.75rem] font-medium leading-snug line-clamp-1"
                style={{ color: 'var(--sw-primary-700)' }}
              >
                {role}
              </p>
            ) : null}
          </header>

          <div className="flex items-center justify-between mt-auto pt-3">
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1 text-[0.75rem] font-semibold transition-all group-hover:gap-2"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {labels.viewProfile}
              <ArrowLeft className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-[-2px] rtl:rotate-180" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
