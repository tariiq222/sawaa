import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, UserCheck, Users } from 'lucide-react';
import type { SectionIntro } from '@/features/site-content/public';
import { SUPPORT_GROUPS } from '../../lib/constants';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

interface Props {
  intro: SectionIntro;
}

interface Tone {
  accent: string;
  soft: string;
  softText: string;
  ring: string;
}

const TONES: Tone[] = [
  {
    accent: 'var(--sw-primary-600)',
    soft: 'var(--sw-primary-50)',
    softText: 'var(--sw-primary-700)',
    ring: 'color-mix(in srgb, var(--primary) 20%, transparent)',
  },
  {
    accent: 'var(--sw-secondary-700)',
    soft: 'var(--sw-secondary-50)',
    softText: 'var(--sw-secondary-700)',
    ring: 'color-mix(in srgb, var(--sw-secondary-700) 20%, transparent)',
  },
  {
    accent: 'var(--sw-tertiary-600)',
    soft: 'var(--sw-tertiary-50)',
    softText: 'var(--sw-tertiary-700)',
    ring: 'color-mix(in srgb, var(--accent) 20%, transparent)',
  },
];

export function SupportGroups({ intro }: Props) {
  return (
    <section id="support-groups" className="py-20 md:py-24 relative">
      <div className="max-w-[1260px] mx-auto px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<Users className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SUPPORT_GROUPS.map((g, i) => {
            const t = TONES[i % TONES.length]!;
            return (
              <AnimatedSection key={g.slug} delay={i * 40}>
                <div
                  className="group grid grid-cols-[150px_1fr] gap-4 items-stretch bg-white rounded-2xl p-4 h-[180px] transition-all duration-300 hover:-translate-y-1"
                  style={{
                    border: '1px solid var(--sw-neutral-100)',
                    boxShadow: 'var(--sw-shadow-xs)',
                  }}
                >
                  <div
                    className="relative w-full h-full rounded-xl overflow-hidden"
                    style={{ boxShadow: `0 0 0 1px ${t.ring}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.image}
                      alt={g.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span
                      className="absolute top-2 end-2 text-[0.625rem] font-extrabold bg-white/95 backdrop-blur px-2 py-0.5 rounded-full"
                      style={{ color: t.softText }}
                    >
                      {g.format}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center py-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: t.soft, color: t.softText }}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        مجموعة دعم
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[0.6rem]"
                        style={{ color: 'var(--sw-neutral-400)' }}
                      >
                        <UserCheck className="w-2.5 h-2.5" />
                        {g.participants}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-[0.6rem]"
                        style={{ color: 'var(--sw-neutral-400)' }}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {g.sessions}
                      </span>
                    </div>

                    <h3
                      className="text-base font-bold mb-1.5 leading-tight transition-colors line-clamp-1"
                      style={{ color: 'var(--sw-secondary-700)' }}
                    >
                      {g.name}
                    </h3>
                    <p
                      className="text-[0.8rem] leading-relaxed mb-2.5 line-clamp-3"
                      style={{ color: 'var(--sw-neutral-600)' }}
                    >
                      {g.desc}
                    </p>

                    <Link
                      href="/support-groups"
                      className="inline-flex items-center gap-1.5 self-start text-[0.7rem] font-bold uppercase tracking-wider transition-all hover:gap-2"
                      style={{ color: t.accent }}
                    >
                      اعرف أكثر
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:-translate-x-1"
                        style={{
                          background: `color-mix(in srgb, ${t.accent} 12%, transparent)`,
                        }}
                      >
                        <ArrowLeft className="w-3 h-3" style={{ color: t.accent }} />
                      </span>
                    </Link>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
