import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
      <div className="sw-home-hero-overlay absolute inset-0" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 sm:px-6 md:px-8">
        <AnimatedSection>
          <span
            className="inline-flex items-center gap-2 text-[0.75rem] font-bold px-5 py-2.5 rounded-full mb-6 overflow-hidden"
            style={{
              color: '#fff',
              background: 'rgba(251,246,237,0.14)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: 'inset 0 0 0 1px rgba(217,190,138,0.46)',
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
            <span style={{ color: 'var(--sw-home-mint)' }}>
              {content.titleHighlight.trim()}
            </span>{' '}
            <span className="block">{content.titleSuffix.trim()}</span>
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
              className="sw-home-primary-cta group inline-flex items-center gap-2.5 font-bold px-8 py-4 rounded-full transition-all hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              style={{
                background: 'var(--sw-primary-500)',
                color: 'var(--sw-home-midnight)',
                fontSize: '0.938rem',
              }}
            >
              {content.ctaPrimaryText}
              <ArrowLeft className="w-[17px] h-[17px]" />
            </Link>
          </div>
        </AnimatedSection>
      </div>

    </section>
  );
}
