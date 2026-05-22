'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Users,
  HandHeart,
  Baby,
  Smile,
  Brain,
  ClipboardList,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import type { SectionIntro } from '@/features/site-content/public';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

export interface ClinicItem {
  id: string;
  slug?: string;
  nameAr: string;
  descriptionAr: string | null;
  icon: string | null;
  image?: string | null;
}

interface Props {
  clinics: ClinicItem[];
  intro: SectionIntro;
}

interface Tone {
  accent: string;
  soft: string;
  softText: string;
  ring: string;
}

const TONE: Tone = {
  accent: 'var(--sw-primary-600)',
  soft: 'var(--sw-primary-50)',
  softText: 'var(--sw-primary-700)',
  ring: 'color-mix(in srgb, var(--primary) 20%, transparent)',
};

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Users,
  Heart,
  HandHeart,
  Baby,
  Smile,
  Brain,
  ClipboardList,
  RefreshCw,
};

function resolveIcon(name: string | null): LucideIcon {
  if (!name) return Sparkles;
  return ICON_MAP[name] ?? Sparkles;
}

export function Clinics({ clinics, intro }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sl = Math.abs(el.scrollLeft);
    setCanScrollRight(sl > 0);
    setCanScrollLeft(sl < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 340;
    scrollRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (clinics.length === 0) {
    return (
      <section id="clinics" className="py-20 md:py-24 relative sw-section-mint">
        <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
          <AnimatedSection>
            <SectionHeader
              tag={intro.tag}
              tagIcon={<Heart className="w-3.5 h-3.5" />}
              title={<IntroTitle intro={intro} />}
              subtitle={intro.subtitle}
            />
          </AnimatedSection>
          <div className="flex justify-center mt-8">
            <div
              className="text-center py-14 px-10 bg-white rounded-2xl max-w-md w-full"
              style={{
                border: '1px solid var(--sw-neutral-100)',
                boxShadow: 'var(--sw-shadow-xs)',
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: 'var(--sw-primary-50)' }}
              >
                <Sparkles className="w-6 h-6" style={{ color: 'var(--sw-primary-600)' }} />
              </div>
              <h3
                className="text-base font-extrabold mb-2"
                style={{ color: 'var(--sw-secondary-700)' }}
              >
                العيادات قيد الإعداد
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--sw-neutral-500)' }}
              >
                نعمل على إضافة عياداتنا المتخصصة. تابعنا قريباً.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="clinics" className="py-20 md:py-24 relative sw-section-mint">
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<Heart className="w-3.5 h-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        <div className="relative">
          <div
            ref={scrollRef}
            dir="rtl"
            className="sw-no-scrollbar flex gap-5 overflow-x-auto overflow-y-visible scroll-smooth pt-4 pb-12 px-6"
          >
            {clinics.map((c, i) => {
              const t = TONE;
              const Icon = resolveIcon(c.icon);
              return (
                <AnimatedSection key={c.id} delay={i * 40} className="flex-shrink-0">
                  <div
                    className="group w-[300px] bg-white rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1"
                    style={{
                      border: '1px solid var(--sw-neutral-100)',
                      boxShadow: 'var(--sw-shadow-xs)',
                    }}
                  >
                    <div
                      className="relative w-full h-[160px] rounded-xl overflow-hidden mb-4 flex items-center justify-center"
                      style={{
                        boxShadow: `0 0 0 1px ${t.ring}`,
                        background: c.image
                          ? undefined
                          : `linear-gradient(135deg, ${t.soft} 0%, ${t.ring} 100%)`,
                      }}
                    >
                      {c.image ? (
                        <Image
                          src={c.image}
                          alt={c.nameAr}
                          width={300}
                          height={160}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <Icon
                          className="w-16 h-16"
                          style={{ color: t.accent }}
                          strokeWidth={1.5}
                        />
                      )}
                      <span
                        className="absolute top-2 end-2 text-[0.625rem] font-extrabold bg-white/95 backdrop-blur px-2 py-0.5 rounded-full"
                        style={{ color: t.softText }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: t.soft, color: t.softText }}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        عيادة متخصصة
                      </span>
                    </div>

                    <h3
                      className="text-base font-bold mb-1.5 leading-tight line-clamp-1"
                      style={{ color: 'var(--sw-secondary-700)' }}
                    >
                      {c.nameAr}
                    </h3>
                    <p
                      className="text-[0.8rem] leading-relaxed mb-3 line-clamp-2"
                      style={{ color: 'var(--sw-neutral-600)' }}
                    >
                      {c.descriptionAr ?? 'عيادة متخصصة بفريق معتمد.'}
                    </p>

                    <span
                      className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider"
                      style={{ color: t.accent }}
                    >
                      اعرف أكثر
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{
                          background: `color-mix(in srgb, ${t.accent} 12%, transparent)`,
                        }}
                      >
                        <ArrowLeft className="w-3 h-3" style={{ color: t.accent }} />
                      </span>
                    </span>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 justify-center mt-6">
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ border: '1px solid var(--sw-neutral-200)' }}
            aria-label="التمرير لليمين"
          >
            <ChevronRight
              className="w-4.5 h-4.5"
              style={{ color: 'var(--sw-neutral-600)' }}
            />
          </button>
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ border: '1px solid var(--sw-neutral-200)' }}
            aria-label="التمرير لليسار"
          >
            <ChevronLeft
              className="w-4.5 h-4.5"
              style={{ color: 'var(--sw-neutral-600)' }}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
