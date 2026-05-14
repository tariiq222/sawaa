import type { SiteSettingsMap } from './types';

export interface FeatureCard {
  label: string;
  title: string;
  desc: string;
  icon: string;
}

export const FEATURE_CARD_COUNT = 3 as const;
export type FeatureCardIndex = 0 | 1 | 2;

export type FeatureCards = readonly [FeatureCard, FeatureCard, FeatureCard];

/**
 * Curated list of Lucide icons that editors can pick from.
 * Extending this is a code change (new import) — intentional so the bundle
 * stays lean and previews stay predictable.
 */
export const FEATURE_CARD_ICONS = [
  'BadgeCheck',
  'ShieldCheck',
  'Clock',
  'Heart',
  'Activity',
  'Users',
  'UserCheck',
  'Sparkles',
  'Star',
  'Award',
  'CheckCircle2',
  'ThumbsUp',
  'Phone',
  'MessageCircle',
  'Calendar',
  'MapPin',
  'Home',
  'Brain',
  'Stethoscope',
  'HeartHandshake',
] as const;

export type FeatureCardIcon = (typeof FEATURE_CARD_ICONS)[number];

const DEFAULTS: FeatureCards = [
  {
    label: 'كوادر سعودية',
    title: 'معالج يفهم ثقافتك',
    desc: 'فريق سعودي مصنّف من الهيئة السعودية للتخصصات الصحية، يتحدث لغتك ويدرك سياقك الاجتماعي والأسري.',
    icon: 'BadgeCheck',
  },
  {
    label: 'سرية طبية',
    title: 'تحدّث بلا قلق',
    desc: 'بياناتك وجلساتك محمية بسرية مهنية مطلقة وفق أعلى المعايير. ما يُقال هنا، يبقى هنا.',
    icon: 'ShieldCheck',
  },
  {
    label: 'جلسات مرنة',
    title: 'احجز اليوم، تحدّث غداً',
    desc: 'مواعيد متاحة طوال الأسبوع — حضورياً في الرياض أو عن بُعد من أي مكان، تختار ما يناسب يومك.',
    icon: 'Clock',
  },
];

export const FEATURE_CARD_DEFAULTS: FeatureCards = DEFAULTS;

export function featureCardKey(
  index: FeatureCardIndex,
  field: keyof FeatureCard,
): string {
  const slot = index + 1;
  if (field === 'icon') return `home.features.card.${slot}.icon`;
  return `home.features.card.${slot}.${field}.ar`;
}

function pickText(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  if (!row) return fallback;
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback;
}

function pickIcon(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  if (!row) return fallback;
  return row.valueText ?? row.valueAr ?? row.valueEn ?? fallback;
}

function resolveCard(map: SiteSettingsMap, index: FeatureCardIndex): FeatureCard {
  const d = DEFAULTS[index];
  return {
    label: pickText(map, featureCardKey(index, 'label'), d.label),
    title: pickText(map, featureCardKey(index, 'title'), d.title),
    desc:  pickText(map, featureCardKey(index, 'desc'),  d.desc),
    icon:  pickIcon(map, featureCardKey(index, 'icon'),  d.icon),
  };
}

export function resolveFeatureCards(map: SiteSettingsMap): FeatureCards {
  return [resolveCard(map, 0), resolveCard(map, 1), resolveCard(map, 2)];
}
