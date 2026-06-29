import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Users,
  CalendarDays,
  Tag,
} from 'lucide-react';
import { getPublicGroupSessions, type SupportGroup } from '@/features/support-groups/support-groups.api';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';
import { halalasToSarNumber } from '@/lib/money';

export async function SawaaSupportGroupsPage() {
  const locale = await getLocale();
  const programs = await getPublicGroupSessions().catch(() => [] as SupportGroup[]);
  const t = (key: MessageKey) => translate(locale, key);

  const total = programs.length;
  const totalSeats = programs.reduce((sum, p) => sum + Math.max(0, p.maxParticipants - p.enrolledCount), 0);

  return (
    <>
      <GroupsHero t={t} total={total} totalSeats={totalSeats} />

      <section className="relative pb-24 md:pb-28 -mt-6">
        <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
          <GroupsGrid programs={programs} locale={locale} t={t} />
        </div>
      </section>

      <NotSureCTA t={t} />
    </>
  );
}

interface HeroProps {
  t: (key: MessageKey) => string;
  total: number;
  totalSeats: number;
}

function GroupsHero({ t, total, totalSeats }: HeroProps) {
  return (
    <section
      className="relative -mt-[88px] pt-[120px] md:pt-[140px] pb-16 md:pb-20 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 800px 480px at 88% 12%, color-mix(in srgb, var(--primary) 9%, transparent) 0%, transparent 60%),' +
          'radial-gradient(ellipse 720px 420px at 8% 90%, color-mix(in srgb, var(--sw-secondary-700) 5%, transparent) 0%, transparent 60%),' +
          'linear-gradient(180deg, #F1FBF9 0%, #F7FDFB 100%)',
      }}
    >
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-7">
            <span
              className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-5"
              style={{ color: 'var(--sw-primary-700)' }}
            >
              <span aria-hidden className="inline-block w-6 h-px" style={{ background: 'currentColor', opacity: 0.5 }} />
              {t('supportGroups.eyebrow')}
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
              {t('supportGroups.headline')}
            </h1>
          </div>

          <div className="md:col-span-5 lg:col-span-4 lg:col-start-9">
            <p className="text-[1rem] md:text-[1.0625rem] leading-[1.85]" style={{ color: 'var(--sw-body)', maxWidth: '38ch' }}>
              {t('supportGroups.lead')}
            </p>
          </div>
        </div>

        <div
          className="mt-14 md:mt-20 pt-10 grid grid-cols-1 sm:grid-cols-3 gap-y-8 sm:gap-x-12"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }}
        >
          <Stat value={String(total).padStart(2, '0')} label={t('supportGroups.statTotal')} />
          <Stat value={String(totalSeats).padStart(2, '0')} label={t('supportGroups.statServices')} withDivider />
          <Stat icon={<BadgeCheck className="w-7 h-7" strokeWidth={1.6} aria-hidden />} label={t('clinics.statLicensed')} withDivider />
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
          style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }}
        />
      ) : null}
      <div className="flex items-center leading-none" style={{ minHeight: 'clamp(2.25rem, 5vw, 3.25rem)' }}>
        {value ? (
          <span
            className="font-extrabold tabular-nums leading-none tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', color: 'var(--sw-secondary-700)', letterSpacing: '-0.03em' }}
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
      <span className="text-[0.875rem] leading-snug" style={{ color: 'var(--sw-neutral-600)', maxWidth: '24ch' }}>
        {label}
      </span>
    </div>
  );
}

interface GridProps {
  programs: SupportGroup[];
  locale: 'ar' | 'en';
  t: (key: MessageKey) => string;
}

function GroupsGrid({ programs, locale, t }: GridProps) {
  if (programs.length === 0) {
    return (
      <div className="flex justify-center mt-8">
        <div
          className="text-center py-14 px-10 bg-white rounded-2xl max-w-md w-full"
          style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--sw-primary-50)' }}>
            <Users className="w-6 h-6" style={{ color: 'var(--sw-primary-600)' }} />
          </div>
          <h3 className="text-base font-extrabold mb-2" style={{ color: 'var(--sw-secondary-700)' }}>
            {t('supportGroups.emptyTitle')}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
            {t('supportGroups.empty')}
          </p>
        </div>
      </div>
    );
  }

  const intl = locale === 'ar' ? 'ar' : 'en-US';
  const fmtMoney = (halalas: number) =>
    new Intl.NumberFormat(intl, { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(
      halalasToSarNumber(halalas),
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
      {programs.map((p, i) => {
        const href = `/support-groups/${encodeURIComponent(p.id)}`;
        const name = locale === 'en' && p.nameEn ? p.nameEn : p.nameAr;
        const description =
          (locale === 'en' && p.publicDescriptionEn) ||
          p.publicDescriptionAr ||
          p.descriptionAr ||
          t('supportGroups.defaultDescription');
        const seatsLeft = Math.max(0, p.maxParticipants - p.enrolledCount);
        const isFull = seatsLeft === 0;
        return (
          <Link
            key={p.id}
            href={href}
            aria-label={`${t('supportGroups.viewCta')} — ${name}`}
            className="group relative block bg-white rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
          >
            <span
              aria-hidden
              className="absolute top-5 end-5 text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--sw-primary-50)', color: 'var(--sw-primary-700)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>

            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, var(--sw-primary-50) 0%, color-mix(in srgb, var(--primary) 18%, transparent) 100%)',
                boxShadow: '0 0 0 1px color-mix(in srgb, var(--primary) 14%, transparent)',
              }}
            >
              <Users className="w-7 h-7" style={{ color: 'var(--sw-primary-700)' }} strokeWidth={1.6} />
            </div>

            <span
              className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full mb-3"
              style={{
                background: isFull ? 'var(--sw-neutral-100)' : 'var(--sw-primary-50)',
                color: isFull ? 'var(--sw-neutral-600)' : 'var(--sw-primary-700)',
              }}
            >
              <Users className="w-2.5 h-2.5" />
              {isFull
                ? t('supportGroups.detail.full')
                : `${seatsLeft} ${seatsLeft === 1 ? t('supportGroups.detail.seatLeft') : t('supportGroups.detail.seatsLeft')}`}
            </span>

            <h3 className="text-lg font-bold mb-2 leading-tight" style={{ color: 'var(--sw-secondary-700)' }}>
              {name}
            </h3>
            <p className="text-[0.875rem] leading-relaxed mb-5" style={{ color: 'var(--sw-neutral-600)' }}>
              {description}
            </p>

            <div
              className="flex items-center gap-4 pt-4 mb-4"
              style={{ borderTop: '1px dashed color-mix(in srgb, var(--sw-secondary-700) 10%, transparent)' }}
            >
              <Meter
                icon={<CalendarDays className="w-3.5 h-3.5" />}
                value={`${p.daysCount} ${t('supportGroups.detail.days')}`}
              />
              <span aria-hidden className="w-px self-stretch" style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 8%, transparent)' }} />
              <Meter
                icon={<Tag className="w-3.5 h-3.5" />}
                value={fmtMoney(Number(p.price))}
              />
            </div>

            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider" style={{ color: 'var(--sw-primary-700)' }}>
              {t('supportGroups.viewCta')}
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:-translate-x-0.5"
                style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
              >
                <ArrowLeft className="w-3 h-3" style={{ color: 'var(--sw-primary-700)' }} />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Meter({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span style={{ color: 'var(--sw-primary-600)' }}>{icon}</span>
      <span className="text-[0.8125rem] font-bold tabular-nums" style={{ color: 'var(--sw-secondary-700)' }}>
        {value}
      </span>
    </div>
  );
}

function NotSureCTA({ t }: { t: (key: MessageKey) => string }) {
  return (
    <section className="pb-24 md:pb-28">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <div className="relative rounded-[28px] overflow-hidden p-10 md:p-14" style={{ background: 'linear-gradient(135deg, var(--sw-secondary-700) 0%, var(--sw-secondary-800) 100%)' }}>
          <div aria-hidden className="absolute -top-20 -end-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 28%, transparent) 0%, transparent 70%)' }} />
          <div aria-hidden className="absolute -bottom-24 -start-12 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 70%)' }} />
          <div className="relative z-10 grid md:grid-cols-12 gap-6 md:gap-10 items-center">
            <div className="md:col-span-8">
              <h2 className="font-extrabold tracking-tight text-white mb-3" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.125rem)', lineHeight: 1.2, letterSpacing: '-0.015em' }}>
                {t('clinics.notSure.title')}
              </h2>
              <p className="leading-[1.85] text-[0.9375rem] md:text-[1rem]" style={{ color: 'rgba(255,255,255,0.78)', maxWidth: '52ch' }}>
                {t('clinics.notSure.body')}
              </p>
            </div>
            <div className="md:col-span-4 md:flex md:justify-end">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[0.9375rem] font-semibold transition-all hover:-translate-y-[2px]"
                style={{ color: 'var(--sw-secondary-700)', boxShadow: 'var(--sw-shadow-md)' }}
              >
                {t('clinics.notSure.cta')}
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
