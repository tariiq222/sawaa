'use client';

import type { PublicBranch } from './booking.api';
import { useT, useLocale } from '@/features/locale/locale-provider';

interface BranchStepProps {
  branches: PublicBranch[];
  onSelect: (branch: PublicBranch) => void;
  /** @deprecated back is handled by the wizard header — kept for compatibility with old tests */
  onBack?: () => void;
}

function isMainBranch(branch: PublicBranch): boolean {
  return branch.isMain === true;
}

export function BranchStep({ branches, onSelect }: BranchStepProps) {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2
          className="text-[1.625rem] sm:text-[1.75rem] font-extrabold tracking-tight leading-tight"
          style={{ color: 'var(--sw-secondary-700)', letterSpacing: '-0.015em' }}
        >
          {t('booking.selectBranch')}
        </h2>
        <p
          className="text-sm leading-relaxed max-w-[52ch]"
          style={{ color: 'var(--sw-body)' }}
        >
          {isAr ? 'اختر الفرع الأقرب لك.' : 'Pick the branch closest to you.'}
        </p>
      </header>

      <ul
        className={`grid gap-3 ${branches.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}
        role="list"
      >
        {branches.map((branch) => {
          const primary = isAr ? branch.nameAr : (branch.nameEn || branch.nameAr);
          const secondary = isAr ? branch.nameEn : branch.nameAr;
          const showSecondary = secondary && secondary !== primary;
          const main = isMainBranch(branch);

          return (
            <li key={branch.id}>
              <button
                type="button"
                onClick={() => onSelect(branch)}
                className="group relative w-full h-full text-start cursor-pointer rounded-[1.25rem] bg-white transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                style={{
                  border: '1.5px solid color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)',
                  boxShadow: 'var(--sw-shadow-xs)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    'color-mix(in srgb, var(--primary) 55%, transparent)';
                  e.currentTarget.style.boxShadow = 'var(--sw-shadow-md)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    'color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)';
                  e.currentTarget.style.boxShadow = 'var(--sw-shadow-xs)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div className="flex items-center gap-4 p-4">
                  <span
                    aria-hidden="true"
                    className="grid place-items-center h-12 w-12 shrink-0 rounded-2xl"
                    style={{
                      background:
                        'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, #FFFFFF), color-mix(in srgb, var(--primary) 7%, #FFFFFF))',
                      color: 'var(--primary-dark)',
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21c-4-4.5-7-8-7-11.5a7 7 0 1 1 14 0C19 13 16 16.5 12 21z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>

                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold text-[0.9375rem] sm:text-base leading-tight truncate"
                        style={{ color: 'var(--sw-secondary-700)' }}
                      >
                        {primary}
                      </span>
                      {main && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.625rem] font-bold"
                          style={{
                            background: 'color-mix(in srgb, var(--accent) 45%, #FFFFFF)',
                            color: 'color-mix(in srgb, var(--accent-dark) 60%, var(--sw-secondary-700))',
                            border: '1px solid color-mix(in srgb, var(--accent-dark) 35%, transparent)',
                          }}
                        >
                          {isAr ? 'الرئيسي' : 'MAIN'}
                        </span>
                      )}
                    </div>

                    {showSecondary && (
                      <span
                        className="text-[0.8125rem] font-medium leading-snug truncate"
                        style={{ color: 'var(--sw-body)' }}
                        dir={isAr ? 'ltr' : 'rtl'}
                      >
                        {secondary}
                      </span>
                    )}

                    {(branch.addressAr || branch.city) && (
                      <span
                        className="flex items-center gap-1.5 mt-0.5 text-xs font-medium leading-snug"
                        style={{ color: 'color-mix(in srgb, var(--sw-secondary-700) 55%, transparent)' }}
                      >
                        <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path d="M7 12c-2.5-2.8-4.5-5-4.5-7.2A4.5 4.5 0 1 1 11.5 4.8C11.5 7 9.5 9.2 7 12z" />
                          <circle cx="7" cy="5" r="1.5" />
                        </svg>
                        <span className="truncate">
                          {branch.addressAr || branch.city}
                        </span>
                      </span>
                    )}
                  </div>

                  <span
                    aria-hidden="true"
                    className="shrink-0 grid place-items-center h-8 w-8 rounded-full transition-all duration-200 group-hover:bg-[var(--primary)] group-hover:text-white"
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
