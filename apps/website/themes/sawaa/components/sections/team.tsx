import Link from 'next/link';
import { ChevronDown, Star, UserRound, Users } from 'lucide-react';
import type { PublicEmployee } from '@deqah/api-client';
import type { SectionIntro } from '@/features/site-content/public';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

interface Props {
  therapists: PublicEmployee[];
  intro: SectionIntro;
  totalCount?: number;
}

const PALETTE: { bg: string; icon: string }[] = [
  { bg: 'var(--sw-primary-50)',   icon: 'var(--sw-primary-600)' },
  { bg: 'var(--sw-secondary-50)', icon: 'var(--sw-secondary-700)' },
  { bg: 'var(--sw-tertiary-50)',  icon: 'var(--sw-tertiary-600)' },
];

const VISIBLE_COUNT = 12;

function firstLetter(name: string | null): string {
  if (!name) return '?';
  const cleaned = name.replace(/^(د\.|أ\.|Dr\.)\s*/i, '').trim();
  return cleaned.charAt(0) || '?';
}

export function Team({ therapists, intro, totalCount }: Props) {
  if (therapists.length === 0) return null;
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
          {visible.map((t, i) => {
            const c = PALETTE[i % PALETTE.length]!;
            const href = t.slug ? `/therapists/${t.slug}` : '/therapists';
            const name = t.nameAr ?? t.nameEn ?? '—';
            const role = t.specialtyAr ?? t.title ?? '';
            return (
              <AnimatedSection key={t.id} delay={i * 30}>
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

                  <span
                    className="absolute top-2 end-2 z-10 inline-flex items-center gap-0.5 bg-white text-[0.625rem] font-bold px-1.5 py-0.5 rounded-full leading-none"
                    style={{
                      color: 'var(--sw-secondary-700)',
                      border: '1px solid var(--sw-neutral-200)',
                      boxShadow: 'var(--sw-shadow-xs)',
                    }}
                  >
                    <Star className="w-2.5 h-2.5" fill="#F59E0B" stroke="#F59E0B" strokeWidth={0} />
                    <span className="tabular-nums">4.9</span>
                  </span>

                  <div
                    className="relative w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 transition-transform duration-300 group-hover:scale-105 flex items-center justify-center"
                    style={{
                      background: c.bg,
                      boxShadow: '0 0 0 3px #fff, var(--sw-shadow-md)',
                    }}
                  >
                    {t.publicImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.publicImageUrl}
                        alt={name}
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
                    اعرف أكثر
                  </span>
                </Link>
              </AnimatedSection>
            );
          })}
          {visible.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <UserRound
                className="w-12 h-12 mx-auto mb-3"
                style={{ color: 'var(--sw-neutral-400)' }}
              />
              <p className="text-sm" style={{ color: 'var(--sw-neutral-500)' }}>
                لم يُضَف أي معالج بعد.
              </p>
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
              عرض كل المعالجين ({total})
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
