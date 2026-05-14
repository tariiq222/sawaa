import { MessageCircle, Quote, Star } from 'lucide-react';
import type { SectionIntro } from '@/features/site-content/public';
import { TESTIMONIALS } from '../../lib/constants';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

interface Props {
  intro: SectionIntro;
}

const AVATAR_TONES = [
  { bg: 'var(--sw-primary-50)',   text: 'var(--sw-primary-700)' },
  { bg: 'var(--sw-tertiary-50)',  text: 'var(--sw-tertiary-700)' },
  { bg: 'var(--sw-secondary-50)', text: 'var(--sw-secondary-700)' },
];

export function Testimonials({ intro }: Props) {
  return (
    <section id="testimonials" className="py-20 md:py-24 relative sw-section-mint">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<MessageCircle className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => {
            const tone = AVATAR_TONES[i % AVATAR_TONES.length]!;
            return (
              <AnimatedSection key={t.name} delay={i * 80}>
                <div
                  className="group relative h-full bg-white rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1.5 flex flex-col"
                  style={{
                    border: '1px solid var(--sw-neutral-100)',
                    boxShadow: 'var(--sw-shadow-xs)',
                  }}
                >
                  <div
                    className="absolute top-6 end-6 w-11 h-11 rounded-full flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--sw-primary-50)' }}
                  >
                    <Quote className="w-5 h-5" style={{ color: 'var(--sw-primary-600)' }} />
                  </div>

                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className="w-4 h-4"
                        fill="var(--sw-tertiary-400)"
                        stroke="var(--sw-tertiary-400)"
                      />
                    ))}
                  </div>
                  <p
                    className="leading-[1.85] mb-7 font-medium flex-1"
                    style={{ color: 'var(--sw-secondary-700)', fontSize: '0.938rem' }}
                  >
                    {t.text}
                  </p>
                  <div
                    className="flex items-center gap-3 pt-5"
                    style={{ borderTop: '1px solid var(--sw-neutral-100)' }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-base"
                      style={{
                        background: tone.bg,
                        color: tone.text,
                        boxShadow: '0 0 0 2px #fff, var(--sw-shadow-sm)',
                      }}
                    >
                      {t.letter}
                    </div>
                    <div>
                      <div
                        className="font-extrabold"
                        style={{ color: 'var(--sw-secondary-700)', fontSize: '0.938rem' }}
                      >
                        {t.name}
                      </div>
                      <div
                        className="text-[0.75rem] font-semibold"
                        style={{ color: 'var(--sw-neutral-500)' }}
                      >
                        {t.label}
                      </div>
                    </div>
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
