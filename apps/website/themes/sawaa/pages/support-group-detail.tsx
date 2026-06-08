import Link from 'next/link';
import { ArrowLeft, Clock, Hourglass, MapPin, Users, CalendarDays, Tag, BadgeCheck } from 'lucide-react';
import { getPublicCatalog } from '@/features/public-catalog/public';
import { getPublicGroupSessions } from '@/features/support-groups/support-groups.api';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';
import { halalasToSarNumber } from '@/lib/money';
import { JoinGroupButton } from '@/features/support-groups/join-group-button';

const GROUP_DEPARTMENT_NAMES = ['جماعية', 'Groups'];

interface Props {
  id: string;
}

export async function SawaaSupportGroupDetailPage({ id }: Props) {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const intl = locale === 'ar' ? 'ar' : 'en-US';

  const [catalog, allSessions] = await Promise.all([
    getPublicCatalog().catch(() => ({ departments: [], categories: [], services: [] })),
    getPublicGroupSessions().catch(() => []),
  ]);

  const groupDept = catalog.departments.find((d) => GROUP_DEPARTMENT_NAMES.includes(d.nameAr));
  const category = groupDept
    ? catalog.categories.find((c) => c.id === id && c.departmentId === groupDept.id && c.isActive)
    : undefined;

  const name = category ? (locale === 'en' && category.nameEn ? category.nameEn : category.nameAr) : '';
  const serviceIds = new Set(
    category ? catalog.services.filter((s) => s.categoryId === category.id).map((s) => s.id) : [],
  );
  const sessions = (allSessions ?? [])
    .filter((s) => serviceIds.has(s.serviceId))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const fmtMoney = (halalas: number) =>
    new Intl.NumberFormat(intl, { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(
      halalasToSarNumber(halalas),
    );

  const priceRange = (() => {
    if (sessions.length === 0) return null;
    const prices = sessions.map((s) => s.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? fmtMoney(min) : `${fmtMoney(min)} – ${fmtMoney(max)}`;
  })();

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

        {!category ? (
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
            {t('supportGroups.detail.notFound')}
          </h1>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* ── Program overview (sticky) ── */}
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
                  {t('supportGroups.defaultDescription')}
                </p>

                <div
                  className="rounded-2xl bg-white p-5 flex flex-col gap-1"
                  style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
                >
                  <FactRow icon={<MapPin className="w-4 h-4" />} label={t('supportGroups.detail.format')} value={t('supportGroups.detail.inPerson')} />
                  <FactRow
                    icon={<CalendarDays className="w-4 h-4" />}
                    label={t('supportGroups.detail.upcoming')}
                    value={`${sessions.length} ${t('supportGroups.detail.sessionsCount')}`}
                  />
                  {priceRange ? (
                    <FactRow icon={<Tag className="w-4 h-4" />} label={t('supportGroups.detail.price')} value={priceRange} last />
                  ) : null}
                </div>

                <p className="mt-4 inline-flex items-start gap-2 text-[0.8125rem] leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
                  <BadgeCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--sw-primary-600)' }} />
                  {t('supportGroups.detail.facilitatorNote')}
                </p>
              </div>
            </aside>

            {/* ── Upcoming sessions ── */}
            <div className="lg:col-span-8">
              <h2 className="text-lg font-extrabold mb-6 flex items-center gap-2" style={{ color: 'var(--sw-secondary-700)' }}>
                <CalendarDays className="w-5 h-5" style={{ color: 'var(--sw-primary-600)' }} />
                {t('supportGroups.detail.upcoming')}
              </h2>

              {sessions.length === 0 ? (
                <div
                  className="text-center py-16 px-8 bg-white rounded-2xl"
                  style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--sw-primary-50)' }}>
                    <CalendarDays className="w-6 h-6" style={{ color: 'var(--sw-primary-600)' }} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
                    {t('supportGroups.detail.noUpcoming')}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sessions.map((s) => {
                    const d = new Date(s.scheduledAt);
                    const seatsLeft = Math.max(0, s.maxCapacity - s.enrolledCount);
                    const isFull = seatsLeft === 0;
                    const pct = s.maxCapacity > 0 ? Math.min(100, Math.round((s.enrolledCount / s.maxCapacity) * 100)) : 0;
                    const weekday = new Intl.DateTimeFormat(intl, { weekday: 'long' }).format(d);
                    const dayNum = new Intl.DateTimeFormat(intl, { day: 'numeric' }).format(d);
                    const month = new Intl.DateTimeFormat(intl, { month: 'short' }).format(d);
                    const time = new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit' }).format(d);
                    return (
                      <article
                        key={s.id}
                        className="bg-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-stretch"
                        style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
                      >
                        {/* Date block */}
                        <div
                          className="shrink-0 flex sm:flex-col items-center justify-center gap-2 sm:gap-0 rounded-xl px-4 py-3 sm:w-[92px]"
                          style={{ background: 'color-mix(in srgb, var(--primary) 7%, transparent)' }}
                        >
                          <span className="text-[0.7rem] font-semibold" style={{ color: 'var(--sw-primary-700)' }}>{weekday}</span>
                          <span className="text-2xl font-extrabold tabular-nums leading-none sm:my-1" style={{ color: 'var(--sw-secondary-700)' }}>{dayNum}</span>
                          <span className="text-[0.7rem] font-semibold" style={{ color: 'var(--sw-neutral-500)' }}>{month}</span>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem]" style={{ color: 'var(--sw-neutral-600)' }}>
                            <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{time}</span>
                            <span className="inline-flex items-center gap-1.5"><Hourglass className="w-3.5 h-3.5" />{s.durationMins} {t('supportGroups.detail.minutes')}</span>
                            <span className="font-extrabold" style={{ color: 'var(--sw-primary-700)' }}>{fmtMoney(s.price)}</span>
                          </div>

                          {/* Seats */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[0.75rem]">
                              <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: isFull ? 'var(--sw-secondary-700)' : 'var(--sw-primary-700)' }}>
                                <Users className="w-3.5 h-3.5" />
                                {isFull
                                  ? t('supportGroups.detail.full')
                                  : `${seatsLeft} ${seatsLeft === 1 ? t('supportGroups.detail.seatLeft') : t('supportGroups.detail.seatsLeft')}`}
                              </span>
                              <span className="tabular-nums" style={{ color: 'var(--sw-neutral-400)' }}>{s.enrolledCount}/{s.maxCapacity}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--sw-neutral-100)' }}>
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: isFull ? 'var(--sw-secondary-700)' : 'var(--sw-primary-500)' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex sm:flex-col sm:justify-center sm:w-[180px]">
                          <JoinGroupButton sessionId={s.id} categoryId={category.id} isFull={isFull} waitlistEnabled={s.waitlistEnabled} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
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
