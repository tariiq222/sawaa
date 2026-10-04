import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { PublicEmployee } from '@sawaa/api-client';
import type { Locale } from '@/features/locale/locale';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';
import { listPublicEmployees, getPublicEmployee } from '@/features/therapists/public';
import { getPublicCatalog, selectBookableClinicServices } from '@/features/public-catalog/public';
import { TherapistCardSawaa } from '../components/therapists/therapist-card';
import { safeImageSrc } from '@/lib/image-url';

interface PageProps {
  slug: string;
  locale: Locale;
}

function initials(name: string | null): string {
  if (!name) return '·';
  const cleaned = name.replace(/^(د\.|أ\.|Dr\.)\s*/i, '').trim();
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0)).join('') || '·';
}

/** First two name words with any leading title stripped (audit T6). */
function shortName(name: string): string {
  const cleaned = name.replace(/^(د\.|أ\.|Dr\.)\s*/i, '').trim();
  return cleaned.split(/\s+/).slice(0, 2).join(' ');
}

export async function SawaaTherapistProfilePage({ slug, locale }: PageProps) {
  const [therapist, all, catalog] = await Promise.all([
    getPublicEmployee(slug),
    listPublicEmployees(true).catch(() => [] as PublicEmployee[]),
    getPublicCatalog().catch(() => ({ departments: [], categories: [], services: [] })),
  ]);

  const t = (key: MessageKey) => translate(locale, key);

  const name = (locale === 'ar' ? therapist.nameAr : therapist.nameEn) ?? therapist.nameAr ?? '—';
  const role = (locale === 'ar' ? therapist.specialtyAr : therapist.specialty) ?? therapist.title ?? '';
  const bio = (locale === 'ar' ? therapist.publicBioAr : therapist.publicBioEn) ?? '';

  const others = all.filter((e) => e.id !== therapist.id).slice(0, 4);

  // What this practitioner offers: visible services they are assigned to
  // (contract: booking options & pricing stay in the wizard — audit T1).
  const offeredServices = selectBookableClinicServices(catalog, [therapist])
    .slice(0, 6)
    .map(({ service }) => service);

  return (
    <>
      {/* Hero: Portrait + identity + meta side-by-side */}
      <section
        className="relative -mt-[88px] pt-[112px] md:pt-[128px] pb-12 md:pb-16 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 720px 420px at 92% 8%, color-mix(in srgb, var(--accent) 7%, transparent) 0%, transparent 60%),' +
            'radial-gradient(ellipse 640px 380px at 5% 95%, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 60%),' +
            'var(--sw-warm-gradient)',
        }}
      >
        <div className="max-w-[1180px] mx-auto px-5 sm:px-6 md:px-8">
          {/* Breadcrumb back */}
          <Link
            href="/therapists"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium mb-8 transition-colors hover:opacity-70"
            style={{ color: 'var(--sw-neutral-500)' }}
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            {t('therapists.profile.back')}
          </Link>

          <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
            {/* Portrait */}
            <div className="md:col-span-4 lg:col-span-3">
              <div
                className="relative aspect-square w-full max-w-[320px] mx-auto md:mx-0 rounded-[24px] overflow-hidden bg-[color:var(--sw-primary-50)]"
                style={{ boxShadow: 'var(--sw-shadow-md)' }}
              >
                {safeImageSrc(therapist.publicImageUrl) ? (
                  <Image
                    src={safeImageSrc(therapist.publicImageUrl)!}
                    alt={name}
                    fill
                    sizes="(min-width: 1024px) 280px, (min-width: 768px) 32vw, 80vw"
                    priority
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="text-[5rem] font-light"
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
            </div>

            {/* Identity + about */}
            <div className="md:col-span-8 lg:col-span-6">
              <div
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-3"
                style={{ color: 'var(--sw-primary-700)' }}
              >
                {role || t('therapists.eyebrow')}
              </div>
              <h1
                className="font-extrabold tracking-tight mb-6"
                style={{
                  fontSize: 'clamp(2rem, 4.2vw, 3rem)',
                  lineHeight: 1.08,
                  color: 'var(--sw-secondary-700)',
                  letterSpacing: '-0.02em',
                  maxWidth: '18ch',
                }}
              >
                {name}
              </h1>

              {bio ? (
                <div
                  className="text-[1rem] md:text-[1.0625rem]"
                  style={{
                    color: 'var(--sw-body)',
                    lineHeight: 1.9,
                    maxWidth: '60ch',
                  }}
                >
                  <h2
                    className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-4"
                    style={{ color: 'var(--sw-neutral-500)' }}
                  >
                    {t('therapists.profile.about')}
                  </h2>
                  <p className="whitespace-pre-line">{bio}</p>
                </div>
              ) : null}

              {offeredServices.length > 0 ? (
                <div className="mt-10" style={{ maxWidth: '60ch' }}>
                  <h2
                    className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] mb-4"
                    style={{ color: 'var(--sw-neutral-500)' }}
                  >
                    {t('therapists.profile.offers')}
                  </h2>
                  <ul className="flex flex-wrap gap-2" role="list">
                    {offeredServices.map((service) => (
                      <li
                        key={service.id}
                        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium rounded-full px-3.5 py-1.5"
                        style={{
                          background: 'var(--sw-primary-50)',
                          color: 'var(--sw-primary-700)',
                          border: '1px solid color-mix(in srgb, var(--sw-primary-600) 18%, transparent)',
                        }}
                      >
                        <Clock className="w-3.5 h-3.5" aria-hidden />
                        {(locale === 'en' ? service.nameEn ?? service.nameAr : service.nameAr) ?? service.nameAr}
                        {service.showDuration !== false ? (
                          <span style={{ color: 'color-mix(in srgb, var(--sw-primary-700) 65%, transparent)' }}>
                            · {service.durationMins} {t('booking.minutesShort')}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* Sidebar: booking CTA only */}
            <aside className="md:col-span-12 lg:col-span-3">
              {therapist.isBookable ? (
                <Link
                  href={`/booking?employeeId=${encodeURIComponent(therapist.id)}`}
                  className="group inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-3.5 text-[0.9375rem] font-semibold transition-all hover:-translate-y-[2px]"
                  style={{
                    background: 'var(--sw-secondary-700)',
                    color: 'var(--sw-secondary-700-foreground)',
                    boxShadow:
                      '0 8px 20px -8px color-mix(in srgb, var(--sw-secondary-900) 35%, transparent)',
                  }}
                >
                  <Calendar className="w-4 h-4" />
                  <span>
                    {t('therapists.profile.bookCta')}{' '}
                    <span className="font-bold">{shortName(name)}</span>
                  </span>
                </Link>
              ) : (
                <p
                  className="text-center text-[0.8125rem] rounded-full px-5 py-3.5"
                  style={{
                    background: 'var(--sw-primary-50)',
                    color: 'var(--sw-neutral-500)',
                  }}
                >
                  {t('therapists.profile.notBookable')}
                </p>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* Others strip */}
      {others.length > 0 ? (
        <section className="py-16 md:py-20">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-6 md:px-8">
            <div className="flex items-end justify-between gap-6 mb-8">
              <h2
                className="font-extrabold tracking-tight"
                style={{
                  fontSize: 'clamp(1.25rem, 2.4vw, 1.625rem)',
                  color: 'var(--sw-secondary-700)',
                  letterSpacing: '-0.015em',
                  maxWidth: '22ch',
                }}
              >
                {t('therapists.profile.others')}
              </h2>
              <Link
                href="/therapists"
                className="hidden sm:inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold transition-all hover:gap-2.5"
                style={{ color: 'var(--sw-secondary-700)' }}
              >
                {t('therapists.profile.back')}
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5">
              {others.map((e) => (
                <TherapistCardSawaa
                  key={e.id}
                  therapist={e}
                  locale={locale}
                  labels={{
                    viewProfile: t('therapists.viewProfile'),
                    noBio: t('therapists.noBio'),
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
