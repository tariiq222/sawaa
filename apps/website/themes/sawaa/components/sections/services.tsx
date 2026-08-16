'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BookableService } from '@/features/public-catalog/public';
import type { SectionIntro } from '@/features/site-content/public';
import { useLocale, useT } from '@/features/locale/locale-provider';
import { AnimatedSection } from '../ui/animated-section';
import { IntroTitle } from '../ui/intro-title';
import { SectionHeader } from '../ui/section-header';
import { ServiceCard } from '../services/service-card';

interface ServicesProps {
  services: BookableService[];
  intro: SectionIntro;
  vatRate?: number;
}

export function Services({ services, intro, vatRate = 0 }: ServicesProps) {
  const locale = useLocale();
  const t = useT();
  const isRtl = locale === 'ar';
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const checkScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const offset = Math.abs(element.scrollLeft);
    setCanScrollBack(offset > 2);
    setCanScrollForward(offset < element.scrollWidth - element.clientWidth - 2);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    checkScroll();
    element.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      element.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  const scroll = (direction: 'back' | 'forward') => {
    const forwardOffset = isRtl ? -340 : 340;
    scrollRef.current?.scrollBy({
      left: direction === 'forward' ? forwardOffset : -forwardOffset,
      behavior: 'smooth',
    });
  };

  const ForwardIcon = isRtl ? ChevronLeft : ChevronRight;
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  return (
    <section id="services" className="sw-section-mint relative py-20 md:py-24">
      <div className="mx-auto max-w-[1260px] px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <SectionHeader
            tag={intro.tag}
            tagIcon={<Sparkles className="h-3.5 w-3.5" />}
            title={<IntroTitle intro={intro} />}
            subtitle={intro.subtitle}
          />
        </AnimatedSection>

        {services.length === 0 ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-white px-10 py-14 text-center" style={{ border: '1px solid var(--sw-neutral-100)', boxShadow: 'var(--sw-shadow-xs)' }}>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--sw-primary-50)' }}>
              <Sparkles className="h-6 w-6" style={{ color: 'var(--sw-primary-600)' }} />
            </div>
            <h3 className="mb-2 text-base font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
              {t('services.emptyTitle')}
            </h3>
            <p className="mb-5 text-sm leading-relaxed" style={{ color: 'var(--sw-neutral-500)' }}>
              {t('services.empty')}
            </p>
            <Link href="/contact" className="inline-flex rounded-full px-5 py-2.5 text-sm font-bold" style={{ background: 'var(--sw-primary-700)', color: '#fff' }}>
              {t('services.contact')}
            </Link>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              dir={isRtl ? 'rtl' : 'ltr'}
              role="region"
              aria-label={t('services.carousel')}
              className="sw-no-scrollbar flex gap-5 overflow-x-auto overflow-y-visible scroll-smooth px-1 pb-10 pt-4"
            >
              {services.map((item, index) => (
                <AnimatedSection key={item.service.id} delay={index * 40} className="w-[300px] shrink-0 sm:w-[320px]">
                  <ServiceCard item={item} vatRate={vatRate} />
                </AnimatedSection>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href="/services"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.8125rem] font-bold transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
                style={{ background: 'var(--sw-primary-700)', color: '#fff', boxShadow: 'var(--sw-shadow-sm)' }}
              >
                {t('services.viewAll')}
                <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
              <button
                type="button"
                onClick={() => scroll('forward')}
                disabled={!canScrollForward}
                aria-label={t('services.scrollNext')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white transition disabled:cursor-not-allowed disabled:opacity-30"
                style={{ border: '1px solid var(--sw-neutral-200)' }}
              >
                <ForwardIcon className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => scroll('back')}
                disabled={!canScrollBack}
                aria-label={t('services.scrollPrevious')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white transition disabled:cursor-not-allowed disabled:opacity-30"
                style={{ border: '1px solid var(--sw-neutral-200)' }}
              >
                <BackIcon className="h-4.5 w-4.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
