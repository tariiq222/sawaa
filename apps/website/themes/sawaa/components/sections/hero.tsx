import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import type { HeroContent } from '@/features/site-content/public';
import { AnimatedSection } from '../ui/animated-section';

interface Props {
  content: HeroContent;
}

export function Hero({ content }: Props) {
  return (
    <section
      id="hero"
      className="relative -mt-[88px] h-screen min-h-[640px] w-full overflow-hidden"
    >
      {/* Full-bleed background image */}
      <Image
        src={content.heroImageUrl}
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority
        loading="eager"
        fetchPriority="high"
      />

      {/* Readability overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, color-mix(in srgb, var(--sw-secondary-900) 80%, transparent) 0%, color-mix(in srgb, var(--sw-secondary-900) 45%, transparent) 45%, color-mix(in srgb, var(--sw-secondary-900) 25%, transparent) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <span
            className="inline-flex items-center gap-2 text-[0.75rem] font-bold px-5 py-2.5 rounded-full mb-6 overflow-hidden"
            style={{
              color: '#fff',
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
            }}
          >
            <span className="relative flex w-2 h-2 overflow-hidden">
              <span className="absolute inset-0 rounded-full opacity-70 animate-ping bg-white" />
              <span className="relative rounded-full w-2 h-2 bg-white" />
            </span>
            {content.badgeText}
          </span>

          <h1
            className="font-extrabold leading-[1.1] mb-5 tracking-tight text-white max-w-[18ch] mx-auto"
            style={{ fontSize: 'clamp(2.25rem, 6vw, 4.25rem)' }}
          >
            {content.titlePrefix.trim()}{' '}
            <span style={{ color: 'var(--sw-primary-300)' }}>
              {content.titleHighlight.trim()}
            </span>{' '}
            {content.titleSuffix.trim()}
          </h1>

          <p
            className="max-w-[560px] mx-auto mb-9 leading-relaxed text-white/85"
            style={{ fontSize: '1.063rem' }}
          >
            {content.subtitle}
          </p>

          <div className="flex gap-3.5 justify-center flex-wrap">
            <Link
              href={content.ctaPrimaryHref}
              className="group inline-flex items-center gap-2.5 font-bold px-8 py-4 rounded-full transition-all hover:-translate-y-[3px]"
              style={{
                background: 'var(--sw-primary-500)',
                color: '#fff',
                fontSize: '0.938rem',
                boxShadow: 'var(--sw-shadow-primary-lg)',
              }}
            >
              {content.ctaPrimaryText}
              <ArrowLeft className="w-[17px] h-[17px]" />
            </Link>
          </div>
        </AnimatedSection>
      </div>

      {/* Scroll-down discover button */}
      <a
        href="#features"
        aria-label="اكتشف المزيد"
        className="group absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-white/80 transition-colors hover:text-white"
      >
        <span className="text-xs font-bold tracking-wide">اكتشف</span>
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center animate-bounce"
          style={{
            background: 'rgba(255,255,255,0.14)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
          }}
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </a>
    </section>
  );
}
