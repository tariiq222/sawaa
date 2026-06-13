export interface FeatureCard {
  label: string;
  title: string;
  desc: string;
  icon: string;
}

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

export const FEATURE_CARD_DEFAULTS: FeatureCards = [
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

export function resolveFeatureCards(): FeatureCards {
  return FEATURE_CARD_DEFAULTS;
}
