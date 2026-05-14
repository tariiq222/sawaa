import Link from 'next/link';
import { ArrowLeft, BadgeCheck, Calendar, Sparkles } from 'lucide-react';
import type { HeroContent } from '@/features/site-content/public';
import { STATS } from '../../lib/constants';
import { AnimatedSection } from '../ui/animated-section';

interface Props {
  content: HeroContent;
}

export function Hero({ content }: Props) {
  return (
    <section id="hero" className="pt-32 pb-12 text-center relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[240px] left-1/2 -translate-x-1/2 w-[1100px] h-[1100px]"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--primary) 14%, transparent) 0%, color-mix(in srgb, var(--primary) 4%, transparent) 40%, transparent 65%)',
          }}
        />
        <div
          className="absolute top-24 -end-[240px] w-[560px] h-[560px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--sw-secondary-700) 5%, transparent) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8 relative z-10">
        <AnimatedSection>
          <span
            className="inline-flex items-center gap-2 text-[0.75rem] font-bold bg-white px-5 py-2.5 rounded-full mb-8"
            style={{
              color: 'var(--sw-primary-700)',
              boxShadow:
                'var(--sw-shadow-xs), inset 0 0 0 1px var(--sw-primary-200)',
            }}
          >
            <span className="relative flex w-2 h-2">
              <span
                className="absolute inset-0 rounded-full opacity-60 animate-ping"
                style={{ background: 'var(--sw-primary-500)' }}
              />
              <span
                className="relative rounded-full w-2 h-2"
                style={{ background: 'var(--sw-primary-500)' }}
              />
            </span>
            {content.badgeText}
          </span>

          <h1
            className="font-extrabold leading-[1.08] mb-5 tracking-tight"
            style={{
              fontSize: 'clamp(2.25rem, 6vw, 3.875rem)',
              color: 'var(--sw-secondary-700)',
            }}
          >
            {content.titlePrefix}{' '}
            <span
              className="relative inline-block"
              style={{ color: 'var(--sw-primary-500)' }}
            >
              {content.titleHighlight}
              <svg
                className="absolute -bottom-2 left-0 w-full h-3"
                viewBox="0 0 200 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 9 Q 50 2 100 6 T 198 4"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.5"
                />
              </svg>
            </span>
            <br />
            {content.titleSuffix}
          </h1>

          <p
            className="max-w-[560px] mx-auto mb-8 leading-relaxed"
            style={{
              fontSize: '1.063rem',
              color: 'var(--sw-neutral-600)',
            }}
          >
            {content.subtitle}
          </p>

          <div className="flex gap-3.5 justify-center flex-wrap mb-12">
            <Link
              href={content.ctaPrimaryHref}
              className="group inline-flex items-center gap-2.5 font-bold px-8 py-4 rounded-full transition-all hover:-translate-y-[3px]"
              style={{
                background: 'var(--sw-primary-500)',
                color: '#fff',
                fontSize: '0.938rem',
                boxShadow: 'var(--sw-shadow-primary)',
              }}
            >
              {content.ctaPrimaryText}
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                <Calendar className="w-[15px] h-[15px]" />
              </span>
            </Link>
            <Link
              href={content.ctaSecondaryHref}
              className="inline-flex items-center gap-2 bg-white font-bold px-8 py-4 rounded-full transition-all hover:-translate-y-[3px]"
              style={{
                fontSize: '0.938rem',
                color: 'var(--sw-secondary-700)',
                boxShadow:
                  'var(--sw-shadow-sm), inset 0 0 0 1px var(--sw-neutral-200)',
              }}
            >
              {content.ctaSecondaryText} <ArrowLeft className="w-[17px] h-[17px]" />
            </Link>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={150}>
          <div className="relative max-w-[980px] mx-auto">
            <div
              className="absolute -inset-6 rounded-[56px] blur-2xl opacity-70"
              style={{
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--primary) 40%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--sw-secondary-700) 20%, transparent) 100%)',
              }}
            />
            <div
              className="relative rounded-[44px] overflow-hidden"
              style={{
                boxShadow: 'var(--sw-shadow-2xl)',
                border: '1px solid rgba(255,255,255,0.6)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={content.heroImageUrl}
                alt="مركز سواء"
                className="w-full h-[280px] sm:h-[350px] md:h-[420px] object-cover"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(to top, color-mix(in srgb, var(--sw-secondary-900) 30%, transparent), transparent 50%)',
                }}
              />
              <div
                className="absolute top-6 end-6 bg-white rounded-2xl px-4 py-2.5 flex items-center gap-2.5"
                style={{ boxShadow: 'var(--sw-shadow-lg)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--sw-primary-50)' }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--sw-primary-600)' }} />
                </div>
                <div className="text-start">
                  <div className="text-[0.625rem] font-semibold" style={{ color: 'var(--sw-neutral-500)' }}>
                    {content.badgeFloatTopLabel}
                  </div>
                  <div className="text-sm font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
                    {content.badgeFloatTopValue}
                  </div>
                </div>
              </div>
              <div
                className="absolute bottom-6 start-6 bg-white rounded-2xl px-4 py-2.5 flex items-center gap-2.5"
                style={{ boxShadow: 'var(--sw-shadow-lg)' }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--sw-tertiary-50)' }}
                >
                  <BadgeCheck className="w-4 h-4" style={{ color: 'var(--sw-tertiary-600)' }} />
                </div>
                <div className="text-start">
                  <div className="text-[0.625rem] font-semibold" style={{ color: 'var(--sw-neutral-500)' }}>
                    {content.badgeFloatBottomLabel}
                  </div>
                  <div className="text-sm font-extrabold" style={{ color: 'var(--sw-secondary-700)' }}>
                    {content.badgeFloatBottomValue}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={250}>
          <div
            className="flex flex-col sm:flex-row justify-center -mt-12 relative z-10 max-w-[720px] mx-auto bg-white rounded-[28px] overflow-hidden"
            style={{
              boxShadow: 'var(--sw-shadow-xl)',
              border: '1px solid var(--sw-neutral-100)',
            }}
          >
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="flex-1 text-center py-7 px-4"
                style={{
                  borderInlineStart:
                    i > 0 ? '1px solid var(--sw-neutral-100)' : 'none',
                }}
              >
                <div
                  className="leading-tight tracking-tight font-extrabold"
                  style={{
                    fontSize: '1.875rem',
                    color: 'var(--sw-primary-600)',
                  }}
                >
                  {s.num}
                </div>
                <div
                  className="text-xs mt-1 font-medium"
                  style={{ color: 'var(--sw-neutral-500)' }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
