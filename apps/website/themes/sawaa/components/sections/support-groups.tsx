import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';

import { getLocale } from '@/features/locale/public';
import { t as translate } from '@/features/locale/dictionary';
import type { SupportGroup } from '@/features/support-groups/support-groups.api';
import type { SectionIntro } from '@/features/site-content/public';
import { halalasToSarNumber } from '@/lib/money';
import { AnimatedSection } from '../ui/animated-section';
import { IntroTitle } from '../ui/intro-title';
import { SectionHeader } from '../ui/section-header';

interface Props {
  intro: SectionIntro;
  items: SupportGroup[];
  loadFailed?: boolean;
}

const HOME_PROGRAM_LIMIT = 4;

export async function SupportGroups({ intro, items, loadFailed = false }: Props) {
  const locale = await getLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <section id="support-groups" className="sw-section-sky relative py-20 md:py-24">
      <div className="mx-auto max-w-[1260px] px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<Users aria-hidden className="h-3.5 w-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        {items.length === 0 ? (
          <div
            className="mx-auto max-w-md rounded-2xl bg-white px-10 py-14 text-center"
            style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
          >
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--sw-primary-50)' }}
            >
              <Users aria-hidden className="h-6 w-6" style={{ color: 'var(--sw-primary-600)' }} />
            </div>
            <h3 className="mb-2 text-base font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
              {t(loadFailed ? 'supportGroups.loadFailedTitle' : 'supportGroups.emptyTitle')}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
              {t(loadFailed ? 'supportGroups.loadFailed' : 'supportGroups.empty')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {items.slice(0, HOME_PROGRAM_LIMIT).map((program, index) => (
                <AnimatedSection key={program.id} delay={index * 40}>
                  <ProgramCard program={program} locale={locale} />
                </AnimatedSection>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/support-groups"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
                style={{ background: 'var(--sw-primary-700)', color: '#fff' }}
              >
                {t('supportGroups.viewAll')}
                <ArrowLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ProgramCard({ program, locale }: { program: SupportGroup; locale: 'ar' | 'en' }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const isEnglish = locale === 'en';
  const name = isEnglish ? program.nameEn?.trim() || program.nameAr : program.nameAr;
  const description = isEnglish
    ? program.publicDescriptionEn?.trim() ||
      program.descriptionEn?.trim() ||
      program.publicDescriptionAr?.trim() ||
      program.descriptionAr?.trim()
    : program.publicDescriptionAr?.trim() || program.descriptionAr?.trim();
  const seatsLeft = Math.max(0, program.spotsLeft);
  const price = Number(program.price);
  const href = `/support-groups/${encodeURIComponent(program.id)}`;
  const startDate = program.startDate
    ? new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'ar-SA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Riyadh',
      }).format(new Date(program.startDate))
    : t('supportGroups.schedulePending');
  const priceLabel =
    price === 0
      ? t('supportGroups.free')
      : new Intl.NumberFormat(isEnglish ? 'en-US' : 'ar-SA', {
          style: 'currency',
          currency: program.currency || 'SAR',
          maximumFractionDigits: 0,
        }).format(halalasToSarNumber(price));

  return (
    <article
      className="group relative h-full overflow-hidden rounded-2xl bg-white p-5 transition duration-300 hover:-translate-y-1 sm:p-6"
      style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
    >
      <div
        aria-hidden
        className="absolute -end-16 -top-20 h-48 w-48 rounded-full"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 8%, transparent)' }}
      />

      <div className="relative mb-5 flex items-start justify-between gap-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-extrabold"
          style={{ background: 'var(--sw-primary-50)', color: 'var(--sw-primary-700)' }}
        >
          <Sparkles aria-hidden className="h-3 w-3" />
          {t('supportGroups.badge')}
        </span>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, var(--sw-primary-50), color-mix(in srgb, var(--sw-primary-500) 16%, white))',
            color: 'var(--sw-primary-700)',
          }}
        >
          <Users aria-hidden className="h-6 w-6" strokeWidth={1.6} />
        </div>
      </div>

      <div className="relative">
        <h3 className="mb-2 text-xl font-extrabold leading-snug" style={{ color: 'var(--sw-secondary-700)' }}>
          {name}
        </h3>
        <p className="mb-5 min-h-[3.5rem] text-sm leading-7" style={{ color: 'var(--sw-neutral-600)' }}>
          {description || t('supportGroups.defaultDescription')}
        </p>

        <div
          className="mb-5 grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl px-4 py-3 text-xs font-semibold sm:grid-cols-2"
          style={{ background: 'color-mix(in srgb, var(--sw-primary-50) 68%, white)', color: 'var(--sw-neutral-600)' }}
        >
          <Fact icon={CalendarDays} value={startDate} />
          <Fact icon={Users} value={`${program.minParticipants}–${program.maxParticipants} ${t('supportGroups.participants')}`} />
          <Fact icon={CalendarDays} value={`${program.daysCount} ${t('supportGroups.detail.days')}`} />
          <Fact icon={Clock3} value={`${program.hoursPerDay} ${t('supportGroups.detail.hoursPerDay')}`} />
          <Fact
            icon={Users}
            value={
              seatsLeft === 1
                ? `1 ${t('supportGroups.detail.seatLeft')}`
                : `${seatsLeft} ${t('supportGroups.detail.seatsLeft')}`
            }
          />
          <Fact icon={WalletCards} value={priceLabel} />
        </div>

        <Link
          href={href}
          aria-label={`${t('supportGroups.viewCta')} — ${name}`}
          className="inline-flex items-center gap-2 rounded-full text-sm font-extrabold transition-all hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          style={{ color: 'var(--sw-primary-700)' }}
        >
          {t('supportGroups.viewCta')}
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: 'var(--sw-primary-50)' }}
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
          </span>
        </Link>
      </div>
    </article>
  );
}

function Fact({ icon: Icon, value }: { icon: typeof CalendarDays; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--sw-primary-600)' }} />
      <span className="min-w-0 whitespace-normal tabular-nums">{value}</span>
    </span>
  );
}
