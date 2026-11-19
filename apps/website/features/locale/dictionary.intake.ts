// Website dictionary — feature group: intake.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'intake.title': 'نماذج ما قبل الجلسة',
  'intake.subtitle': 'يرجى تعبئة النماذج التالية لمساعدة المختص على الاستعداد لجلستك.',
  'intake.submit': 'إرسال',
  'intake.submitting': 'جارٍ الإرسال...',
  'intake.submitted': 'تم إرسال إجاباتك بنجاح. شكراً لك.',
  'intake.submitError': 'تعذّر إرسال النموذج، حاول مرة أخرى.',
  'intake.required': 'هذا الحقل مطلوب',
} as const;

const en: Record<keyof typeof ar, string> = {
  'intake.title': 'Pre-session forms',
  'intake.subtitle': 'Please complete the forms below to help your therapist prepare for your session.',
  'intake.submit': 'Submit',
  'intake.submitting': 'Submitting...',
  'intake.submitted': 'Your answers were submitted successfully. Thank you.',
  'intake.submitError': 'Could not submit the form, please try again.',
  'intake.required': 'This field is required',
};

export const intakeDictionary: LocalizedDictionary<typeof ar> = { ar, en };
