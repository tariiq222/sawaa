// Website dictionary — feature group: burnout.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'burnout.title': 'اختبار الإرهاق النفسي',
  'burnout.description': 'أجب عن الأسئلة التالية لمعرفة مستوى الإرهاق.',
  'burnout.submit': 'عرض النتيجة',
  'burnout.result.low': 'مستوى منخفض — حالتك جيدة.',
  'burnout.result.medium': 'مستوى متوسط — نوصي بأخذ قسط من الراحة.',
  'burnout.result.high': 'مستوى مرتفع — ننصح بحجز استشارة.',
} as const;

const en: Record<keyof typeof ar, string> = {
  'burnout.title': 'Burnout Self-Assessment',
  'burnout.description': 'Answer the questions below to see your level.',
  'burnout.submit': 'See result',
  'burnout.result.low': 'Low level — you are doing well.',
  'burnout.result.medium': 'Medium level — consider taking a break.',
  'burnout.result.high': 'High level — we recommend booking a consultation.',
};

export const burnoutDictionary: LocalizedDictionary<typeof ar> = { ar, en };
