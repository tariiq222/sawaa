// Website dictionary — feature group: therapists.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'therapists.title': 'معالجونا',
  'therapists.empty': 'لم يتم نشر أي معالجين بعد.',
  'therapists.tag': 'المعالجون',
  'therapists.eyebrow': 'المعالجون',
  'therapists.headline': 'تعرّف على من قد يساعدك',
  'therapists.lead':
    'الخطوة الأصعب أن تبدأ. بعدها تحتاج فقط معالجاً يفهم وضعك. اقرأ خلفية كل واحد منهم بهدوء، ثم احجز موعداً مع من تشعر معه بالارتياح.',
  'therapists.statTotal': 'معالج معتمد',
  'therapists.statLicensed': 'معتمدون من هيئة التخصصات الصحية',
  'therapists.statConfidential': 'سرية تامة',
  'therapists.filterAll': 'الكل',
  'therapists.viewProfile': 'تعرّف على المعالج',
  'therapists.book': 'احجز معه',
  'therapists.notSure.title': 'ما زلت متردداً في الاختيار؟',
  'therapists.notSure.body':
    'تواصل معنا، وسنرشّح لك المعالج الأنسب لحالتك بعد محادثة قصيرة مع فريق الاستقبال. بدون التزام.',
  'therapists.notSure.cta': 'تواصل معنا',
  'therapists.profile.back': 'كل المعالجين',
  'therapists.profile.about': 'نبذة',
  'therapists.profile.bookCta': 'احجز موعد مع',
  'therapists.profile.others': 'معالجون آخرون قد تهتم بهم',
  'therapists.profile.offers': 'ما يقدمه',
  'therapists.profile.notBookable': 'غير متاح للحجز حالياً',
} as const;

const en: Record<keyof typeof ar, string> = {
  'therapists.title': 'Our Therapists',
  'therapists.empty': 'No therapists published yet.',
  'therapists.tag': 'The Team',
  'therapists.eyebrow': 'The Team',
  'therapists.headline': 'Meet the people who can help',
  'therapists.lead':
    'Starting is the hardest part. After that, you only need a therapist who understands your situation. Read about each one calmly, then book with whoever feels right.',
  'therapists.statTotal': 'Certified therapists',
  'therapists.statLicensed': 'Saudi Commission for Health Specialties certified',
  'therapists.statConfidential': 'Strictly confidential',
  'therapists.filterAll': 'All',
  'therapists.viewProfile': 'View profile',
  'therapists.book': 'Book with them',
  'therapists.notSure.title': 'Still unsure who to choose?',
  'therapists.notSure.body':
    'Reach out and our front desk will suggest the right therapist after a brief conversation. No commitment.',
  'therapists.notSure.cta': 'Talk to our team',
  'therapists.profile.back': 'All therapists',
  'therapists.profile.about': 'About',
  'therapists.profile.bookCta': 'Book with',
  'therapists.profile.others': 'Other therapists you may consider',
  'therapists.profile.offers': 'What they offer',
  'therapists.profile.notBookable': 'Not available for booking right now',
};

export const therapistsDictionary: LocalizedDictionary<typeof ar> = { ar, en };
