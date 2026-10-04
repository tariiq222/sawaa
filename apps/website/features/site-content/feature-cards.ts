import type { Locale } from '@/features/locale/locale';

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

export const FEATURE_CARD_DEFAULTS_EN: FeatureCards = [
  {
    label: 'Saudi specialists',
    title: 'A therapist who understands your culture',
    desc: 'Our Saudi team is licensed by the Saudi Commission for Health Specialties. They speak your language and understand your social and family context.',
    icon: 'BadgeCheck',
  },
  {
    label: 'Professional confidentiality',
    title: 'Speak freely',
    desc: 'Your information and sessions are protected by strict professional confidentiality. What you share here stays here.',
    icon: 'ShieldCheck',
  },
  {
    label: 'Flexible sessions',
    title: 'Book today, talk tomorrow',
    desc: 'Appointments are available throughout the week, in person in Riyadh or remotely from anywhere. Choose what fits your day.',
    icon: 'Clock',
  },
];

export function resolveFeatureCards(locale: Locale = 'ar'): FeatureCards {
  return locale === 'en' ? FEATURE_CARD_DEFAULTS_EN : FEATURE_CARD_DEFAULTS;
}
