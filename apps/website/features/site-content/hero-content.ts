import type { Locale } from '@/features/locale/locale';
import type { HeroContent, SiteSettingsMap } from './types';

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

function pickText(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  if (!row) return fallback;
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback;
}

/**
 * Resolve a localized text setting. In EN we prefer the `.en` key (and the
 * row's English value), falling back to the AR key/value, then the EN default,
 * then the AR default. In AR the behavior is byte-identical to `pickText`.
 */
function pickLocalized(
  map: SiteSettingsMap,
  keyAr: string,
  keyEn: string,
  fallbackAr: string,
  fallbackEn: string,
  locale: Locale,
): string {
  if (locale === 'en') {
    const enRow = map.get(keyEn);
    const enValue = enRow?.valueEn ?? enRow?.valueText ?? enRow?.valueAr;
    if (enValue) return enValue;
    const arRow = map.get(keyAr);
    const arValue = arRow?.valueEn ?? arRow?.valueText ?? arRow?.valueAr;
    return arValue ?? fallbackEn ?? fallbackAr;
  }
  return pickText(map, keyAr, fallbackAr);
}

function pickMedia(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  return row?.valueMedia ?? fallback;
}

export function resolveHeroContent(map: SiteSettingsMap, locale: Locale = 'ar'): HeroContent {
  const d = locale === 'en' ? DEFAULTS_EN : DEFAULTS;
  const L = (
    keyAr: string,
    keyEn: string,
    fallbackAr: string,
    fallbackEn: string,
  ): string => pickLocalized(map, keyAr, keyEn, fallbackAr, fallbackEn, locale);

  return {
    badgeText:             L('home.hero.badge.ar',             'home.hero.badge.en',             DEFAULTS.badgeText,             DEFAULTS_EN.badgeText),
    titlePrefix:           L('home.hero.titlePrefix.ar',       'home.hero.titlePrefix.en',       DEFAULTS.titlePrefix,           DEFAULTS_EN.titlePrefix),
    titleHighlight:        L('home.hero.titleHighlight.ar',    'home.hero.titleHighlight.en',    DEFAULTS.titleHighlight,        DEFAULTS_EN.titleHighlight),
    titleSuffix:           L('home.hero.titleSuffix.ar',       'home.hero.titleSuffix.en',       DEFAULTS.titleSuffix,           DEFAULTS_EN.titleSuffix),
    subtitle:              L('home.hero.subtitle.ar',          'home.hero.subtitle.en',          DEFAULTS.subtitle,              DEFAULTS_EN.subtitle),
    ctaPrimaryText:        L('home.hero.ctaPrimary.text.ar',   'home.hero.ctaPrimary.text.en',   DEFAULTS.ctaPrimaryText,        DEFAULTS_EN.ctaPrimaryText),
    ctaPrimaryHref:        pickText(map, 'home.hero.ctaPrimary.href',   d.ctaPrimaryHref),
    ctaSecondaryText:      L('home.hero.ctaSecondary.text.ar', 'home.hero.ctaSecondary.text.en', DEFAULTS.ctaSecondaryText,      DEFAULTS_EN.ctaSecondaryText),
    ctaSecondaryHref:      pickText(map, 'home.hero.ctaSecondary.href', d.ctaSecondaryHref),
    heroImageUrl:          pickMedia(map, 'home.hero.heroImage',        d.heroImageUrl),
    badgeFloatTopLabel:    L('home.hero.badgeTop.label.ar',    'home.hero.badgeTop.label.en',    DEFAULTS.badgeFloatTopLabel,    DEFAULTS_EN.badgeFloatTopLabel),
    badgeFloatTopValue:    L('home.hero.badgeTop.value.ar',    'home.hero.badgeTop.value.en',    DEFAULTS.badgeFloatTopValue,    DEFAULTS_EN.badgeFloatTopValue),
    badgeFloatBottomLabel: L('home.hero.badgeBottom.label.ar', 'home.hero.badgeBottom.label.en', DEFAULTS.badgeFloatBottomLabel, DEFAULTS_EN.badgeFloatBottomLabel),
    badgeFloatBottomValue: L('home.hero.badgeBottom.value.ar', 'home.hero.badgeBottom.value.en', DEFAULTS.badgeFloatBottomValue, DEFAULTS_EN.badgeFloatBottomValue),
  };
}

export const HERO_CONTENT_KEYS: (keyof HeroContent)[] = [
  'badgeText',
  'titlePrefix',
  'titleHighlight',
  'titleSuffix',
  'subtitle',
  'ctaPrimaryText',
  'ctaPrimaryHref',
  'ctaSecondaryText',
  'ctaSecondaryHref',
  'heroImageUrl',
  'badgeFloatTopLabel',
  'badgeFloatTopValue',
  'badgeFloatBottomLabel',
  'badgeFloatBottomValue',
];
