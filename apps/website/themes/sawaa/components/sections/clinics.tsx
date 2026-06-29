'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
import { safeImageSrc } from '@/lib/image-url';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { AnimatedSection } from '../ui/animated-section';
import { SectionHeader } from '../ui/section-header';
import { IntroTitle } from '../ui/intro-title';

export interface ClinicItem {
  id: string;
  slug?: string;
  nameAr: string;
  nameEn?: string | null;
  descriptionAr: string | null;
  descriptionEn?: string | null;
  icon: string | null;
  image?: string | null;
  iconBgColor?: string | null;
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
  const t = useT();
  const locale = useLocale();
  const clinicName = (c: ClinicItem): string =>
    (locale === 'en' ? c.nameEn?.trim() || c.nameAr : c.nameAr);
  const clinicDescription = (c: ClinicItem): string | null =>
    locale === 'en' ? c.descriptionEn?.trim() || c.descriptionAr : c.descriptionAr;
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
                {t('clinics.emptyTitle')}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--sw-neutral-500)' }}
              >
                {t('clinics.empty')}
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
              const tone = TONE;
              const Icon = resolveIcon(c.icon);
              const href = `/booking?categoryId=${encodeURIComponent(c.id)}`;
              const name = clinicName(c);
              const description = clinicDescription(c);
              // Guard against a bare object key reaching next/image (throws).
              const img = safeImageSrc(c.image);
              return (
                <AnimatedSection key={c.id} delay={i * 40} className="flex-shrink-0">
                  <Link
                    href={href}
                    aria-label={`${t('clinics.bookAria')} ${name}`}
                    className="group block w-[300px] bg-white rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
                    style={{
                      border: '1px solid var(--sw-neutral-100)',
                      boxShadow: 'var(--sw-shadow-xs)',
                    }}
                  >
                    <div
                      className="relative w-full h-[160px] rounded-xl overflow-hidden mb-4 flex items-center justify-center"
                      style={{
                        boxShadow: `0 0 0 1px ${tone.ring}`,
                        background: img
                          ? undefined
                          : c.iconBgColor
                          ? `${c.iconBgColor}22`
                          : `linear-gradient(135deg, ${tone.soft} 0%, ${tone.ring} 100%)`,
                      }}
                    >
                      {img ? (
                        <Image
                          src={img}
                          alt={name}
                          width={300}
                          height={160}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <Icon
                          className="w-16 h-16"
                          style={{ color: c.iconBgColor ?? tone.accent }}
                          strokeWidth={1.5}
                        />
                      )}
                      <span
                        className="absolute top-2 end-2 text-[0.625rem] font-extrabold bg-white/95 backdrop-blur px-2 py-0.5 rounded-full"
                        style={{ color: tone.softText }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: tone.soft, color: tone.softText }}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {t('clinics.cardBadge')}
                      </span>
                    </div>

                    <h3
                      className="text-base font-bold mb-1.5 leading-tight line-clamp-1"
                      style={{ color: 'var(--sw-secondary-700)' }}
                    >
                      {name}
                    </h3>
                    <p
                      className="text-[0.8rem] leading-relaxed mb-3 line-clamp-2"
                      style={{ color: 'var(--sw-neutral-600)' }}
                    >
                      {description ?? t('clinics.defaultDescription')}
                    </p>

                    <span
                      className="inline-flex items-center gap-1.5 text-[0.7rem] font-bold uppercase"
                      style={{ color: tone.accent }}
                    >
                      {t('clinics.bookCta')}
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:-translate-x-0.5"
                        style={{
                          background: `color-mix(in srgb, ${tone.accent} 12%, transparent)`,
                        }}
                      >
                        <ArrowLeft className="w-3 h-3" style={{ color: tone.accent }} />
                      </span>
                    </span>
                  </Link>
                </AnimatedSection>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 justify-center mt-6">
          <Link
            href="/clinics"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.8125rem] font-bold transition-all hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{
              background: 'var(--sw-primary-700)',
              color: '#fff',
              boxShadow: 'var(--sw-shadow-sm)',
            }}
          >
            {t('clinics.viewAll')}
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ border: '1px solid var(--sw-neutral-200)' }}
            aria-label={t('clinics.scrollNext')}
          >
            <ChevronRight
              className="w-4.5 h-4.5"
              style={{ color: 'var(--sw-neutral-600)' }}
            />
          </button>
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ border: '1px solid var(--sw-neutral-200)' }}
            aria-label={t('clinics.scrollPrev')}
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
