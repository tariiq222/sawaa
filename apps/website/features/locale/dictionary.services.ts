// Website dictionary — feature group: services.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'services.cardBadge': 'متاحة للحجز',
  'services.viewAll': 'عرض جميع الخدمات',
  'services.bookCta': 'ابدأ الحجز',
  'services.bookAria': 'ابدأ حجز',
  'services.duration': 'دقيقة',
  'services.inPerson': 'حضوري',
  'services.online': 'عن بُعد',
  'services.specialist': 'مختص',
  'services.specialists': 'مختصين',
  'services.emptyTitle': 'لا توجد خدمات متاحة حاليًا',
  'services.empty': 'نعمل على تجهيز الخدمات المتاحة للحجز. تواصل معنا وسنساعدك في اختيار الخطوة المناسبة.',
  'services.contact': 'تواصل معنا',
  'services.page.count': 'خدمات متاحة للحجز',
  'services.carousel': 'الخدمات المتاحة للحجز',
  'services.scrollNext': 'الخدمة التالية',
  'services.scrollPrevious': 'الخدمة السابقة',
} as const;

const en: Record<keyof typeof ar, string> = {
  'services.cardBadge': 'Available to book',
  'services.viewAll': 'View all services',
  'services.bookCta': 'Start booking',
  'services.bookAria': 'Start booking',
  'services.duration': 'min',
  'services.inPerson': 'In-person',
  'services.online': 'Online',
  'services.specialist': 'specialist',
  'services.specialists': 'specialists',
  'services.emptyTitle': 'No services available right now',
  'services.empty': 'We are preparing the services available to book. Contact us and we will help you choose the right next step.',
  'services.contact': 'Contact us',
  'services.page.count': 'services available to book',
  'services.carousel': 'Bookable services',
  'services.scrollNext': 'Next service',
  'services.scrollPrevious': 'Previous service',
};

export const servicesDictionary: LocalizedDictionary<typeof ar> = { ar, en };
