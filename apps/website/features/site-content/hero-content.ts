import type { Locale } from '@/features/locale/locale';
import type { HeroContent } from './types';

const DEFAULTS: HeroContent = {
  badgeText: 'مركز معتمد للاستشارات النفسية والأسرية',
  titlePrefix: 'رحلتك نحو',
  titleHighlight: 'السواء',
  titleSuffix: 'تبدأ اليوم',
  subtitle:
    'معالج يفهم ثقافتك، بيئة آمنة لا تحاسب، وسرّية مهنية تامة. جلسات حضورية في الرياض أو عن بُعد — متى ما كنت جاهزاً.',
  ctaPrimaryText: 'احجز موعدك',
  ctaPrimaryHref: '/booking',
  ctaSecondaryText: 'استكشف المعالجين',
  ctaSecondaryHref: '/therapists',
  heroImageUrl: '/images/hero.webp',
  badgeFloatTopLabel: 'خبرة تتجاوز',
  badgeFloatTopValue: '15 عاماً',
  badgeFloatBottomLabel: 'مؤهلون من',
  badgeFloatBottomValue: 'هيئة التخصصات',
};

const DEFAULTS_EN: HeroContent = {
  badgeText: 'Accredited center for psychological & family counseling',
  titlePrefix: 'Your journey toward',
  titleHighlight: 'balance',
  titleSuffix: 'starts today',
  subtitle:
    'A therapist who understands your culture, a safe non-judgmental space, and full professional confidentiality. In-person sessions in Riyadh or remote — whenever you are ready.',
  ctaPrimaryText: 'Book your appointment',
  ctaPrimaryHref: '/booking',
  ctaSecondaryText: 'Explore therapists',
  ctaSecondaryHref: '/therapists',
  heroImageUrl: '/images/hero.webp',
  badgeFloatTopLabel: 'Over',
  badgeFloatTopValue: '15 years',
  badgeFloatBottomLabel: 'Certified by',
  badgeFloatBottomValue: 'the Health Specialties Commission',
};

export function resolveHeroContent(locale: Locale = 'ar'): HeroContent {
  return locale === 'en' ? DEFAULTS_EN : DEFAULTS;
}
