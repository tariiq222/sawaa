import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Lock } from 'lucide-react';
import { listPublicEmployees } from '@/features/therapists/public';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';
import { TherapistsGrid } from '../components/therapists/therapists-grid';

interface SawaaTherapistsPageProps {
  initialSpecialty?: string | null;
}

export async function SawaaTherapistsPage({ initialSpecialty = null }: SawaaTherapistsPageProps = {}) {
  const locale = await getLocale();
  const therapists = await listPublicEmployees();
  const t = (key: MessageKey) => translate(locale, key);

  const total = therapists.length;

  return (
    <>
      <TherapistsHero locale={locale} t={t} total={total} />

      <section className="relative pb-24 md:pb-28 -mt-6">
        <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
          <TherapistsGrid
            therapists={therapists}
            locale={locale}
            initialSpecialty={initialSpecialty}
            labels={{
              filterAll: t('therapists.filterAll'),
              viewProfile: t('therapists.viewProfile'),
              noBio: t('therapists.noBio'),
              empty: t('therapists.empty'),
            }}
          />
        </div>
      </section>

      <NotSureCTA t={t} />
    </>
  );
}

interface HeroProps {
  locale: 'ar' | 'en';
  t: (key: MessageKey) => string;
  total: number;
}

function TherapistsHero({ locale, t, total }: HeroProps) {
  return (
    <section
      className="relative -mt-[88px] pt-[120px] md:pt-[140px] pb-16 md:pb-20 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 800px 480px at 88% 12%, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 60%),' +
          'radial-gradient(ellipse 720px 420px at 8% 90%, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 60%),' +
          'linear-gradient(180deg, #FBF7F2 0%, #FDFAF6 100%)',
      }}
    >
      {/* Subtle marker quote — decorative comma in a navy hue, ARABIC has its own quote glyph for character */}
      <span
        aria-hidden
        className="absolute select-none pointer-events-none"
        style={{
          top: '6%',
          insetInlineStart: '4%',
          fontSize: 'clamp(7rem, 16vw, 14rem)',
          color: 'color-mix(in srgb, var(--sw-secondary-700) 5%, transparent)',
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: 'var(--font-primary)',
        }}
      >
        {locale === 'ar' ? '«' : '“'}
      </span>

      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          {/* Left column — eyebrow + headline */}
          <div className="md:col-span-7 lg:col-span-7">
            <span
              className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-5"
              style={{ color: 'var(--sw-primary-700)' }}
            >
              <span
                aria-hidden
                className="inline-block w-6 h-px"
                style={{ background: 'currentColor', opacity: 0.5 }}
              />
              {t('therapists.eyebrow')}
            </span>
            <h1
              className="font-extrabold tracking-tight"
              style={{
                fontSize: 'clamp(2.25rem, 5.5vw, 4rem)',
                lineHeight: 1.05,
                color: 'var(--sw-secondary-700)',
                letterSpacing: '-0.02em',
                maxWidth: '14ch',
              }}
            >
              {t('therapists.headline')}
            </h1>
          </div>

          {/* Right column — lead paragraph, intentionally narrower for editorial rhythm */}
          <div className="md:col-span-5 lg:col-span-4 lg:col-start-9">
            <p
              className="text-[1rem] md:text-[1.0625rem] leading-[1.85]"
              style={{
                color: 'var(--sw-body)',
                maxWidth: '38ch',
              }}
            >
              {t('therapists.lead')}
            </p>
          </div>
        </div>

        {/* Stats strip — three measures, separated by hairlines, NOT cards */}
        <div
          className="mt-14 md:mt-20 pt-10 grid grid-cols-1 sm:grid-cols-3 gap-y-8 sm:gap-x-12"
          style={{
            borderTop: '1px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)',
          }}
        >
          <Stat
            value={String(total).padStart(2, '0')}
            label={t('therapists.statTotal')}
          />
          <Stat
            icon={<BadgeCheck className="w-7 h-7" strokeWidth={1.6} aria-hidden />}
            label={t('therapists.statLicensed')}
            withDivider
          />
          <Stat
            icon={<Lock className="w-7 h-7" strokeWidth={1.6} aria-hidden />}
            label={t('therapists.statConfidential')}
            withDivider
          />
        </div>
      </div>
    </section>
  );
}

interface StatProps {
  value?: string;
  label: string;
  icon?: React.ReactNode;
  withDivider?: boolean;
}

function Stat({ value, label, icon, withDivider }: StatProps) {
  return (
    <div className="relative flex flex-col gap-3 sm:ps-12">
      {withDivider ? (
        <span
          aria-hidden
          className="hidden sm:block absolute inset-y-1 start-0 w-px"
          style={{
            background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)',
          }}
        />
      ) : null}
      <div
        className="flex items-center leading-none"
        style={{ minHeight: 'clamp(2.25rem, 5vw, 3.25rem)' }}
      >
        {value ? (
          <span
            className="font-extrabold tabular-nums leading-none tracking-tight"
            style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
              color: 'var(--sw-secondary-700)',
              letterSpacing: '-0.03em',
            }}
          >
            {value}
          </span>
        ) : (
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-full"
            style={{
              width: 'clamp(2.75rem, 4.5vw, 3.25rem)',
              height: 'clamp(2.75rem, 4.5vw, 3.25rem)',
              background: 'color-mix(in srgb, var(--sw-primary-600) 10%, transparent)',
              color: 'var(--sw-primary-700)',
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <span
        className="text-[0.875rem] leading-snug"
        style={{ color: 'var(--sw-neutral-600)', maxWidth: '24ch' }}
      >
        {label}
      </span>
    </div>
  );
}

function NotSureCTA({ t }: { t: (key: MessageKey) => string }) {
  return (
    <section className="pb-24 md:pb-28">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <div
          className="relative rounded-[28px] overflow-hidden p-10 md:p-14"
          style={{
            background:
              'linear-gradient(135deg, var(--sw-secondary-700) 0%, var(--sw-secondary-800) 100%)',
          }}
        >
          <div
            aria-hidden
            className="absolute -top-20 -end-16 w-72 h-72 rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -start-12 w-80 h-80 rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 grid md:grid-cols-12 gap-6 md:gap-10 items-center">
            <div className="md:col-span-8">
              <h2
                className="font-extrabold tracking-tight text-white mb-3"
                style={{
                  fontSize: 'clamp(1.5rem, 3vw, 2.125rem)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.015em',
                }}
              >
                {t('therapists.notSure.title')}
              </h2>
              <p
                className="leading-[1.85] text-[0.9375rem] md:text-[1rem]"
                style={{ color: 'rgba(255,255,255,0.78)', maxWidth: '52ch' }}
              >
                {t('therapists.notSure.body')}
              </p>
            </div>
            <div className="md:col-span-4 md:flex md:justify-end">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[0.9375rem] font-semibold transition-all hover:-translate-y-[2px]"
                style={{
                  color: 'var(--sw-secondary-700)',
                  boxShadow: 'var(--sw-shadow-md)',
                }}
              >
                {t('therapists.notSure.cta')}
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
