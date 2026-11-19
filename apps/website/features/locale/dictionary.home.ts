// Website dictionary — feature group: hero, cta, team, blog, testimonials.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'hero.discoverMore': 'اكتشف المزيد',
  'hero.discover': 'اكتشف',
  'cta.availableNow': 'متاح الآن',
  'cta.title': 'احجز موعدك الآن',
  'cta.subtitle': 'فريقنا جاهز لمساعدتك — سرية تامة',
  'cta.inPerson': 'حضوري',
  'cta.online': 'عن بُعد',
  'cta.duration': '45 دقيقة',
  'cta.book': 'احجز',
  'cta.comingSoon': 'قريباً',
  'cta.appTitle': 'حمّل تطبيق سواء',
  'cta.appSubtitle': 'احجز جلساتك من جوالك بكل سهولة',
  'team.learnMore': 'اعرف أكثر',
  'team.emptyTitle': 'المعالجون قيد الإضافة',
  'team.empty': 'نعمل على إضافة فريقنا من المعالجين المعتمدين. تابعنا قريباً.',
  'team.viewAll': 'عرض كل المعالجين',
  'blog.authorFallback': 'فريق سواء',
  'blog.read': 'اقرأ',
  'blog.contentHeading': 'المحتوى',
  'blog.contentPending': 'المحتوى قيد الإعداد',
  'blog.otherPosts': 'مقالات أخرى',
  'blog.backHome': 'العودة للرئيسية',
  'testimonials.clientFallback': 'عميل',
} as const;

const en: Record<keyof typeof ar, string> = {
  'hero.discoverMore': 'Discover more',
  'hero.discover': 'Discover',
  'cta.availableNow': 'Available now',
  'cta.title': 'Book your appointment now',
  'cta.subtitle': 'Our team is ready to help — fully confidential',
  'cta.inPerson': 'In-person',
  'cta.online': 'Online',
  'cta.duration': '45 minutes',
  'cta.book': 'Book',
  'cta.comingSoon': 'Coming soon',
  'cta.appTitle': 'Download the Sawa app',
  'cta.appSubtitle': 'Book your sessions easily from your phone',
  'team.learnMore': 'Learn more',
  'team.emptyTitle': 'Therapists coming soon',
  'team.empty': 'We are adding our team of licensed therapists. Stay tuned.',
  'team.viewAll': 'View all therapists',
  'blog.authorFallback': 'Sawa Team',
  'blog.read': 'Read',
  'blog.contentHeading': 'Content',
  'blog.contentPending': 'Content coming soon',
  'blog.otherPosts': 'Other articles',
  'blog.backHome': 'Back to home',
  'testimonials.clientFallback': 'Client',
};

export const homeDictionary: LocalizedDictionary<typeof ar> = { ar, en };
