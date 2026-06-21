import Link from 'next/link';
import { ArrowLeft, Clock, Users, CalendarDays, Tag, BadgeCheck } from 'lucide-react';
import { getPublicGroupSession } from '@/features/support-groups/support-groups.api';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';
import { halalasToSarNumber } from '@/lib/money';
import { JoinGroupButton } from '@/features/support-groups/join-group-button';

interface Props {
  id: string;
}

const fmtDate = (iso: string | null | undefined, locale: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const intl = locale === 'ar' ? 'ar' : 'en-US';
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

export async function SawaaSupportGroupDetailPage({ id }: Props) {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const intl = locale === 'ar' ? 'ar' : 'en-US';

  const program = await getPublicGroupSession(id).catch(() => null);

  const fmtMoney = (halalas: number) =>
    new Intl.NumberFormat(intl, { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(
      halalasToSarNumber(halalas),
    );

  if (!program) {
    return (
      <section className="sw-section-mint relative overflow-hidden -mt-[88px] pt-[120px] pb-20">
        <div className="relative max-w-[1180px] mx-auto px-5">
          <Link
            href="/support-groups"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium mb-8"
            style={{ color: 'var(--sw-neutral-500)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            {t('supportGroups.detail.back')}
          </Link>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
            {t('supportGroups.detail.notFound')}
          </h1>
        </div>
      </section>
    );
  }

  const name = locale === 'en' && program.nameEn ? program.nameEn : program.nameAr;
  const description =
    (locale === 'en' && program.publicDescriptionEn) ||
    program.publicDescriptionAr ||
    program.descriptionAr ||
    t('supportGroups.defaultDescription');
  const seatsLeft = Math.max(0, program.maxParticipants - program.enrolledCount);
  const isFull = seatsLeft === 0;
  const pct =
    program.maxParticipants > 0
      ? Math.min(100, Math.round((program.enrolledCount / program.maxParticipants) * 100))
      : 0;

  return (
    <section
      className="sw-section-mint relative overflow-hidden -mt-[88px] pt-[120px] sm:pt-[140px] pb-20 md:pb-28"
      style={{ minHeight: '100vh' }}
    >
      <div className="relative max-w-[1180px] mx-auto px-5 sm:px-6 md:px-8">
        <Link
          href="/support-groups"
          className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium mb-8 transition-colors hover:opacity-70"
          style={{ color: 'var(--sw-neutral-500)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          {t('supportGroups.detail.back')}
        </Link>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ── Program overview ── */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <span
                className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold px-3 py-1 rounded-full mb-5"
                style={{ background: 'var(--sw-primary-50)', color: 'var(--sw-primary-700)' }}
              >
                <Users className="w-3 h-3" />
                {t('supportGroups.badge')}
              </span>
              <h1
                className="font-extrabold tracking-tight mb-4"
                style={{
                  fontSize: 'clamp(1.9rem, 4vw, 2.875rem)',
                  lineHeight: 1.1,
                  color: 'var(--sw-secondary-700)',
                  letterSpacing: '-0.02em',
                }}
              >
                {name}
              </h1>
              <p className="text-[1rem] leading-[1.85] mb-7" style={{ color: 'var(--sw-body)' }}>
                {description}
              </p>

              <div
                className="rounded-2xl bg-white p-5 flex flex-col gap-1"
                style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
              >
                <FactRow
                  icon={<CalendarDays className="w-4 h-4" />}
                  label={t('supportGroups.detail.format')}
                  value={`${program.daysCount} ${t('supportGroups.detail.days')} · ${program.hoursPerDay} ${t('supportGroups.detail.hoursPerDay')}`}
                />
                <FactRow
                  icon={<Clock className="w-4 h-4" />}
                  label={t('supportGroups.detail.startDate')}
                  value={fmtDate(program.startDate, locale) || '—'}
                />
                <FactRow
                  icon={<Tag className="w-4 h-4" />}
                  label={t('supportGroups.detail.price')}
                  value={fmtMoney(Number(program.price))}
                  last
                />
              </div>

              <p className="mt-4 inline-flex items-start gap-2 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
                <BadgeCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--sw-primary-600)' }} />
                {t('supportGroups.detail.facilitatorNote')}
              </p>
            </div>
          </aside>

          {/* ── Enrollment summary + CTA ── */}
          <div className="lg:col-span-8">
            <h2 className="text-lg font-extrabold mb-6 flex items-center gap-2" style={{ color: 'var(--sw-secondary-700)' }}>
              <CalendarDays className="w-5 h-5" style={{ color: 'var(--sw-primary-600)' }} />
              {t('supportGroups.detail.upcoming')}
            </h2>

            <article
              className="bg-white rounded-2xl p-6 sm:p-8"
              style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem]" style={{ color: 'var(--sw-neutral-600)' }}>
                  <span className="font-extrabold" style={{ color: 'var(--sw-primary-700)' }}>
                    {fmtMoney(Number(program.price))}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[0.75rem]">
                    <span
                      className="inline-flex items-center gap-1.5 font-semibold"
                      style={{ color: isFull ? 'var(--sw-secondary-700)' : 'var(--sw-primary-700)' }}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {isFull
                        ? t('supportGroups.detail.full')
                        : `${seatsLeft} ${seatsLeft === 1 ? t('supportGroups.detail.seatLeft') : t('supportGroups.detail.seatsLeft')}`}
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--sw-neutral-400)' }}>
                      {program.enrolledCount}/{program.maxParticipants}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--sw-neutral-100)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: isFull ? 'var(--sw-secondary-700)' : 'var(--sw-primary-500)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <JoinGroupButton sessionId={program.id} categoryId={program.id} isFull={isFull} />
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function FactRow({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2.5"
      style={last ? undefined : { borderBottom: '1px solid var(--sw-neutral-100)' }}
    >
      <span className="inline-flex items-center gap-2 text-[0.8125rem]" style={{ color: 'var(--sw-neutral-500)' }}>
        <span style={{ color: 'var(--sw-primary-600)' }}>{icon}</span>
        {label}
      </span>
      <span className="text-[0.875rem] font-bold" style={{ color: 'var(--sw-secondary-700)' }}>{value}</span>
    </div>
  );
}
