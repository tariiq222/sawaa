import Link from 'next/link';
import { ArrowLeft, Calendar, Smartphone } from 'lucide-react';
import { AnimatedSection } from '../ui/animated-section';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';

export async function CTA() {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <section id="cta" className="px-5 sm:px-6 md:px-8 py-20 md:py-24">
      <div className="max-w-[1260px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        <AnimatedSection>
          <div
            className="relative h-full min-h-[168px] rounded-[28px] p-8 overflow-hidden flex flex-col justify-between"
            style={{
              background:
                'linear-gradient(135deg, var(--sw-primary-500) 0%, var(--sw-primary-600) 100%)',
              boxShadow: 'var(--sw-shadow-primary-lg)',
            }}
          >
            <div className="absolute -top-10 -start-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -end-16 w-48 h-48 rounded-full bg-white/5" />
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-extrabold text-white bg-white/15 px-2.5 py-1 rounded-full mb-2 uppercase">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  {t('cta.availableNow')}
                </span>
                <h3 className="text-[1.25rem] font-extrabold text-white mb-1 leading-tight">
                  {t('cta.title')}
                </h3>
                <p className="text-[0.813rem] text-white/85 leading-snug">
                  {t('cta.subtitle')}
                </p>
              </div>
            </div>
            <div className="relative z-10 flex items-center justify-between gap-3 mt-5 pt-5 border-t border-white/15">
              <div className="flex items-center gap-2 text-[0.688rem] text-white/80 font-semibold">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                  {t('cta.inPerson')}
                </span>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                  {t('cta.online')}
                </span>
                <span className="text-white/40">·</span>
                <span>{t('cta.duration')}</span>
              </div>
              <Link
                href="/booking"
                className="inline-flex items-center gap-1.5 bg-white font-extrabold text-[0.813rem] px-5 py-2.5 rounded-full hover:-translate-y-0.5 transition-all"
                style={{
                  color: 'var(--sw-primary-600)',
                  boxShadow: 'var(--sw-shadow-md)',
                }}
              >
                {t('cta.book')} <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={100}>
          <div
            className="relative h-full min-h-[168px] rounded-[28px] p-8 overflow-hidden flex flex-col justify-between"
            style={{
              background:
                'linear-gradient(135deg, var(--sw-secondary-700) 0%, var(--sw-secondary-800) 100%)',
              boxShadow: 'var(--sw-shadow-xl)',
            }}
          >
            <div
              className="absolute -top-10 -end-10 w-40 h-40 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
            />
            <div
              className="absolute -bottom-16 -start-16 w-48 h-48 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
            />
            <div className="relative z-10 flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl backdrop-blur flex items-center justify-center shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--primary) 20%, transparent)',
                }}
              >
                <Smartphone className="w-6 h-6" style={{ color: 'var(--sw-primary-400)' }} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <span
                  className="inline-flex items-center gap-1.5 text-[0.625rem] font-extrabold px-2.5 py-1 rounded-full mb-2 uppercase"
                  style={{
                    color: 'var(--sw-primary-400)',
                    background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                  }}
                >
                  <span
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ background: 'var(--sw-primary-400)' }}
                  />
                  {t('cta.comingSoon')}
                </span>
                <h3 className="text-[1.25rem] font-extrabold text-white mb-1 leading-tight">
                  {t('cta.appTitle')}
                </h3>
                <p className="text-[0.813rem] text-white/70 leading-snug">
                  {t('cta.appSubtitle')}
                </p>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-2 mt-5 pt-5 border-t border-white/10">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur text-white rounded-xl px-3.5 py-2 flex-1 justify-center">
                <span className="text-[0.75rem] font-extrabold text-white">App Store</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 backdrop-blur text-white rounded-xl px-3.5 py-2 flex-1 justify-center">
                <span className="text-[0.75rem] font-extrabold text-white">Google Play</span>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
