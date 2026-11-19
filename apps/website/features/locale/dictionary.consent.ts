// Website dictionary — feature group: consent.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  // Cookie consent banner (GDPR/PDPL — explicit opt-in for analytics)
  'consent.title': 'إعدادات ملفات تعريف الارتباط',
  'consent.body':
    'يستخدم هذا الموقع ملفات تعريف الارتباط اللازمة لتشغيله. بموافقتك نستخدم أيضاً ملفات تعريف ارتباط تحليلية لقياس أداء الموقع. يمكنك تعديل تفضيلاتك في أي وقت من أسفل الصفحة.',
  'consent.details':
    'ملفات تعريف الارتباط الأساسية لا يمكن تعطيلها (ضرورية للجلسة). التحليلية تساعدنا على فهم استخدام الزوار (مثل Plausible، بدون ملفات تعريف ارتباط، دون مشاركة بيانات مع أطراف ثالثة).',
  'consent.showDetails': 'اعرف أكثر',
  'consent.hideDetails': 'إخفاء التفاصيل',
  'consent.acceptAll': 'اقبل الكل',
  'consent.essentialOnly': 'الأساسية فقط',
  'consent.decline': 'أرفض',
} as const;

const en: Record<keyof typeof ar, string> = {
  // Cookie consent banner (GDPR/PDPL — explicit opt-in for analytics)
  'consent.title': 'Cookie Settings',
  'consent.body':
    'This site uses cookies that are necessary for it to operate. With your consent we also use analytics cookies to measure site performance. You can change your preferences at any time from the bottom of the page.',
  'consent.details':
    'Essential cookies cannot be disabled (required for the session). Analytics helps us understand how visitors use the site (e.g. Plausible, no cookies, no data sharing with third parties).',
  'consent.showDetails': 'Learn more',
  'consent.hideDetails': 'Hide details',
  'consent.acceptAll': 'Accept all',
  'consent.essentialOnly': 'Essential only',
  'consent.decline': 'Decline',
};

export const consentDictionary: LocalizedDictionary<typeof ar> = { ar, en };
