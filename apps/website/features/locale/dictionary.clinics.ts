// Website dictionary — feature group: clinics.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'clinics.eyebrow': 'العيادات',
  'clinics.headline': 'عيادة لكل احتياج',
  'clinics.lead':
    'كل عيادة عندنا متخصصة بمجال معيّن، يقودها معالجون معتمدون. اختر العيادة الأقرب لحالتك، أو تواصل معنا لنرشّحها لك.',
  'clinics.statTotal': 'عيادة متخصصة',
  'clinics.statTherapists': 'معالج معتمد',
  'clinics.statLicensed': 'معتمدون من هيئة التخصصات الصحية',
  'clinics.statServices': 'خدمة متاحة للحجز',
  'clinics.badgeSpecialty': 'عيادة متخصصة',
  'clinics.viewTherapists': 'عرض المعالجين',
  'clinics.bookCta': 'احجز موعد',
  'clinics.meterTherapists': 'معالج',
  'clinics.meterServices': 'خدمة',
  'clinics.defaultDescription': 'عيادة متخصصة بفريق معتمد وخدمات مصمَّمة لاحتياجك.',
  'clinics.emptyTitle': 'العيادات قيد الإعداد',
  'clinics.empty': 'نعمل على إضافة عياداتنا المتخصصة. تابعنا قريباً.',
  'clinics.notSure.title': 'غير متأكد أي عيادة تناسبك؟',
  'clinics.loadFailedTitle': 'تعذر تحميل العيادات',
  'clinics.loadFailed': 'العيادات غير متاحة الآن. حدّث الصفحة أو حاول مرة أخرى لاحقاً.',
  'clinics.notSure.body':
    'تواصل معنا، وسنرشّح لك العيادة الأنسب لحالتك بعد محادثة قصيرة مع فريق الاستقبال. بدون التزام.',
  'clinics.notSure.cta': 'تواصل معنا',
  'clinics.cardBadge': 'عيادة متخصصة',
  'clinics.viewAll': 'عرض كل العيادات',
  'clinics.bookAria': 'احجز في',
  'clinics.scrollNext': 'التمرير لليمين',
  'clinics.scrollPrev': 'التمرير لليسار',
} as const;

const en: Record<keyof typeof ar, string> = {
  'clinics.eyebrow': 'Our Clinics',
  'clinics.headline': 'A clinic for every need',
  'clinics.lead':
    'Each clinic focuses on a specific area, led by certified therapists. Choose the one closest to your situation, or reach out so we can point you to the right place.',
  'clinics.statTotal': 'Specialized clinics',
  'clinics.statTherapists': 'Certified therapists',
  'clinics.statLicensed': 'Saudi Commission for Health Specialties certified',
  'clinics.statServices': 'services available to book',
  'clinics.badgeSpecialty': 'Specialty clinic',
  'clinics.viewTherapists': 'View therapists',
  'clinics.bookCta': 'Book now',
  'clinics.meterTherapists': 'therapists',
  'clinics.meterServices': 'services',
  'clinics.defaultDescription': 'A specialized clinic with certified therapists and services tailored to your needs.',
  'clinics.emptyTitle': 'Clinics are being prepared',
  'clinics.empty': 'We are adding our specialty clinics. Stay tuned.',
  'clinics.notSure.title': 'Not sure which clinic fits?',
  'clinics.loadFailedTitle': 'Clinics could not be loaded',
  'clinics.loadFailed': 'Clinics are unavailable right now. Refresh the page or try again later.',
  'clinics.notSure.body':
    'Reach out and our front desk will point you to the right clinic after a brief conversation. No commitment.',
  'clinics.notSure.cta': 'Talk to our team',
  'clinics.cardBadge': 'Specialized clinic',
  'clinics.viewAll': 'View all clinics',
  'clinics.bookAria': 'Book at',
  'clinics.scrollNext': 'Scroll right',
  'clinics.scrollPrev': 'Scroll left',
};

export const clinicsDictionary: LocalizedDictionary<typeof ar> = { ar, en };
