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
  heroImageUrl: '/images/hero.jpg',
  badgeFloatTopLabel: 'خبرة تتجاوز',
  badgeFloatTopValue: '15 عاماً',
  badgeFloatBottomLabel: 'مؤهلون من',
  badgeFloatBottomValue: 'هيئة التخصصات',
};

function pickText(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  if (!row) return fallback;
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback;
}

function pickMedia(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  return row?.valueMedia ?? fallback;
}

export function resolveHeroContent(map: SiteSettingsMap): HeroContent {
  return {
    badgeText:             pickText(map, 'home.hero.badge.ar',             DEFAULTS.badgeText),
    titlePrefix:           pickText(map, 'home.hero.titlePrefix.ar',       DEFAULTS.titlePrefix),
    titleHighlight:        pickText(map, 'home.hero.titleHighlight.ar',    DEFAULTS.titleHighlight),
    titleSuffix:           pickText(map, 'home.hero.titleSuffix.ar',       DEFAULTS.titleSuffix),
    subtitle:              pickText(map, 'home.hero.subtitle.ar',          DEFAULTS.subtitle),
    ctaPrimaryText:        pickText(map, 'home.hero.ctaPrimary.text.ar',   DEFAULTS.ctaPrimaryText),
    ctaPrimaryHref:        pickText(map, 'home.hero.ctaPrimary.href',      DEFAULTS.ctaPrimaryHref),
    ctaSecondaryText:      pickText(map, 'home.hero.ctaSecondary.text.ar', DEFAULTS.ctaSecondaryText),
    ctaSecondaryHref:      pickText(map, 'home.hero.ctaSecondary.href',    DEFAULTS.ctaSecondaryHref),
    heroImageUrl:          pickMedia(map, 'home.hero.heroImage',           DEFAULTS.heroImageUrl),
    badgeFloatTopLabel:    pickText(map, 'home.hero.badgeTop.label.ar',    DEFAULTS.badgeFloatTopLabel),
    badgeFloatTopValue:    pickText(map, 'home.hero.badgeTop.value.ar',    DEFAULTS.badgeFloatTopValue),
    badgeFloatBottomLabel: pickText(map, 'home.hero.badgeBottom.label.ar', DEFAULTS.badgeFloatBottomLabel),
    badgeFloatBottomValue: pickText(map, 'home.hero.badgeBottom.value.ar', DEFAULTS.badgeFloatBottomValue),
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
