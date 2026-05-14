'use client';

import { useState } from 'react';
import { HelpCircle, Plus } from 'lucide-react';
import type { SectionIntro } from '@/features/site-content/public';
import { FAQS } from '../../lib/constants';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

interface Props {
  intro: SectionIntro;
}

export function FAQ({ intro }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-24 relative">
      <div className="max-w-[860px] mx-auto px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<HelpCircle className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <AnimatedSection key={item.q} delay={i * 40}>
                <div
                  className="bg-white rounded-2xl transition-all duration-300"
                  style={{
                    border: `1px solid ${isOpen ? 'var(--sw-primary-200)' : 'var(--sw-neutral-100)'}`,
                    boxShadow: isOpen ? 'var(--sw-shadow-md)' : 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-right"
                  >
                    <span
                      className="font-extrabold leading-snug flex-1"
                      style={{ color: 'var(--sw-secondary-700)', fontSize: '0.938rem' }}
                    >
                      {item.q}
                    </span>
                    <span
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                      style={{
                        background: isOpen ? 'var(--sw-primary-500)' : 'var(--sw-primary-50)',
                        color: isOpen ? '#fff' : 'var(--sw-primary-600)',
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                      }}
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    </span>
                  </button>

                  <div
                    className="grid transition-all duration-300 ease-out"
                    style={{
                      gridTemplateRows: isOpen ? '1fr' : '0fr',
                      opacity: isOpen ? 1 : 0,
                    }}
                  >
                    <div className="overflow-hidden">
                      <p
                        className="px-6 pb-6 leading-relaxed"
                        style={{
                          color: 'var(--sw-neutral-600)',
                          fontSize: '0.813rem',
                        }}
                      >
                        {item.a}
                      </p>
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
