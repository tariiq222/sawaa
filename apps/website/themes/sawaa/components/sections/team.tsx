import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, UserRound, Users } from 'lucide-react';
import type { PublicEmployee } from '@sawaa/api-client';
import type { SectionIntro } from '@/features/site-content/public';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';
import { getLocale } from '@/features/locale/public';
import { safeImageSrc } from '@/lib/image-url';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';

interface Props {
  therapists: PublicEmployee[];
  intro: SectionIntro;
  totalCount?: number;
}

const TONE = { bg: 'var(--sw-primary-50)', icon: 'var(--sw-primary-600)' };

const VISIBLE_COUNT = 12;

function firstLetter(name: string | null): string {
  if (!name) return '?';
  const cleaned = name.replace(/^(د\.|أ\.|Dr\.)\s*/i, '').trim();
  return cleaned.charAt(0) || '?';
}

export async function Team({ therapists, intro, totalCount }: Props) {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  const visible = therapists.slice(0, VISIBLE_COUNT);
  const total = totalCount ?? therapists.length;

  return (
    <section id="team" className="py-20 md:py-24 relative sw-section-cream">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<Users className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {visible.map((member, i) => {
            const c = TONE;
            const href = member.slug ? `/therapists/${member.slug}` : '/therapists';
            const name =
              (locale === 'en'
                ? member.nameEn ?? member.nameAr
                : member.nameAr ?? member.nameEn) ?? '—';
            const role = member.specialtyAr ?? member.title ?? '';
            return (
              <AnimatedSection key={member.id} delay={i * 30}>
                <Link
                  href={href}
                  className="group relative block h-full bg-white rounded-2xl transition-all duration-300 hover:-translate-y-1 px-3 pt-9 pb-7 text-center overflow-hidden"
                  style={{
                    border: '1px solid var(--sw-neutral-100)',
                    boxShadow: 'var(--sw-shadow-xs)',
                  }}
                >
                  <div
                    className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
                    style={{ background: c.bg }}
                  />

                  <div
                    className="relative w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 transition-transform duration-300 group-hover:scale-105 flex items-center justify-center"
                    style={{
                      background: c.bg,
                      boxShadow: '0 0 0 3px #fff, var(--sw-shadow-md)',
                    }}
                  >
                    {safeImageSrc(member.publicImageUrl) ? (
                      <Image
                        src={safeImageSrc(member.publicImageUrl)!}
                        alt={name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="text-2xl font-extrabold"
                        style={{ color: c.icon }}
                      >
                        {firstLetter(name)}
                      </span>
                    )}
                  </div>

                  <h3
                    className="relative text-[0.813rem] font-extrabold mb-0.5 leading-tight tracking-tight line-clamp-1"
                    style={{ color: 'var(--sw-secondary-700)' }}
                  >
                    {name}
                  </h3>
                  <p
                    className="relative text-[0.688rem] font-semibold mb-2.5 line-clamp-1"
                    style={{ color: 'var(--sw-neutral-500)' }}
                  >
                    {role}
                  </p>

                  <span
                    className="relative inline-flex items-center gap-1 text-[0.75rem] font-extrabold transition-all group-hover:gap-1.5"
                    style={{ color: 'var(--sw-primary-600)' }}
                  >
                    {t('team.learnMore')}
                  </span>
                </Link>
              </AnimatedSection>
            );
          })}
          {visible.length === 0 ? (
            <div className="col-span-full flex justify-center mt-2">
              <div
                className="text-center py-14 px-10 bg-white rounded-2xl max-w-md w-full"
                style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'var(--sw-primary-50)' }}
                >
                  <UserRound className="w-6 h-6" style={{ color: 'var(--sw-primary-600)' }} />
                </div>
                <h3 className="text-base font-extrabold mb-2" style={{ color: 'var(--sw-secondary-700)' }}>
                  {t('team.emptyTitle')}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
                  {t('team.empty')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {total > VISIBLE_COUNT ? (
          <div className="relative z-10 flex justify-center mt-8">
            <Link
              href="/therapists"
              className="group inline-flex items-center gap-2.5 bg-white font-extrabold text-[0.813rem] ps-6 pe-5 py-3.5 rounded-full transition-all hover:-translate-y-0.5"
              style={{
                border: '1px solid var(--sw-neutral-200)',
                color: 'var(--sw-secondary-700)',
                boxShadow: 'var(--sw-shadow-md)',
              }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: 'var(--sw-primary-500)', color: '#fff' }}
              >
                <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
              </span>
              {`${t('team.viewAll')} (${total})`}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
