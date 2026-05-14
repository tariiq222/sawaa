import * as Icons from 'lucide-react';
import { Activity, BadgeCheck, Sparkles, type LucideIcon } from 'lucide-react';
import type { FeatureCards, SectionIntro } from '@/features/site-content/public';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

interface Props {
  intro: SectionIntro;
  cards: FeatureCards;
}

interface Tone {
  bg: string;
  text: string;
  ring: string;
}

const TONES: readonly [Tone, Tone, Tone] = [
  {
    bg: 'var(--sw-primary-50)',
    text: 'var(--sw-primary-600)',
    ring: 'color-mix(in srgb, var(--primary) 15%, transparent)',
  },
  {
    bg: 'var(--sw-secondary-50)',
    text: 'var(--sw-secondary-700)',
    ring: 'color-mix(in srgb, var(--sw-secondary-700) 15%, transparent)',
  },
  {
    bg: 'var(--sw-tertiary-50)',
    text: 'var(--sw-tertiary-600)',
    ring: 'color-mix(in srgb, var(--accent) 15%, transparent)',
  },
];

function resolveIcon(name: string): LucideIcon {
  const iconMap = Icons as unknown as Record<string, LucideIcon>;
  return iconMap[name] ?? BadgeCheck;
}

export function Features({ intro, cards }: Props) {
  return (
    <section id="features" className="py-20 md:py-24 relative">
      <div className="max-w-[1260px] mx-auto px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<Activity className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} breakBeforeSuffix />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map((card, i) => {
            const tone = TONES[i] ?? TONES[0];
            const Icon = resolveIcon(card.icon) ?? Sparkles;
            return (
              <AnimatedSection key={`${card.label}-${i}`} delay={i * 80}>
                <div
                  className="h-full bg-white rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  style={{
                    border: '1px solid var(--sw-neutral-100)',
                    boxShadow: 'var(--sw-shadow-xs)',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                    style={{
                      background: tone.bg,
                      boxShadow: `0 0 0 4px ${tone.ring}`,
                    }}
                  >
                    <Icon className="w-7 h-7" style={{ color: tone.text }} strokeWidth={2} />
                  </div>
                  <span
                    className="text-[0.75rem] font-bold uppercase tracking-widest mb-2"
                    style={{ color: tone.text }}
                  >
                    {card.label}
                  </span>
                  <h3
                    className="text-[1.125rem] font-extrabold leading-snug mb-2.5"
                    style={{ color: 'var(--sw-secondary-700)' }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="text-[0.813rem] leading-relaxed"
                    style={{ color: 'var(--sw-neutral-600)' }}
                  >
                    {card.desc}
                  </p>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
