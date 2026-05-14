/**
 * Features section cards (3 cards × {label, title, desc, icon}).
 * Mirrors website/features/site-content/feature-cards.
 */

/** Curated Lucide icons — kept in sync with website FEATURE_CARD_ICONS. */
export const FEATURE_CARD_ICON_OPTIONS = [
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
] as const

export type FeatureCardIcon = (typeof FEATURE_CARD_ICON_OPTIONS)[number]

export interface FeatureCardValues {
  label: string
  title: string
  desc: string
  icon: FeatureCardIcon
}

export interface FeatureCardsFormValues {
  cards: [FeatureCardValues, FeatureCardValues, FeatureCardValues]
}

export type FeatureCardField = keyof FeatureCardValues

export const FEATURE_CARD_FIELDS = [
  'label',
  'title',
  'desc',
  'icon',
] as const satisfies readonly FeatureCardField[]

export const FEATURE_CARD_COUNT = 3 as const
export type FeatureCardIndex = 0 | 1 | 2

export function featureCardKey(
  index: FeatureCardIndex,
  field: FeatureCardField,
): string {
  const slot = index + 1
  if (field === 'icon') return `home.features.card.${slot}.icon`
  return `home.features.card.${slot}.${field}.ar`
}

export const FEATURE_CARD_DEFAULTS: FeatureCardsFormValues = {
  cards: [
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
  ],
}
