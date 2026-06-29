import type { Locale } from '@/features/locale/locale';

export interface SectionIntro {
  tag: string;
  titlePrefix: string;
  titleHighlight: string;
  titleSuffix: string;
  subtitle: string;
}

export type SectionIntroKey =
  | 'features'
  | 'clinics'
  | 'supportGroups'
  | 'team'
  | 'testimonials'
  | 'blog'
  | 'faq'
  | 'cta';

export interface HomeSectionIntros {
  features: SectionIntro;
  clinics: SectionIntro;
  supportGroups: SectionIntro;
  team: SectionIntro;
  testimonials: SectionIntro;
  blog: SectionIntro;
  faq: SectionIntro;
  cta: SectionIntro;
}

export const SECTION_INTRO_DEFAULTS: HomeSectionIntros = {
  features: {
    tag: 'ميزاتنا',
    titlePrefix: 'كل ما يخص',
    titleHighlight: 'صحتك النفسية',
    titleSuffix: 'في مكان واحد',
    subtitle: 'نقدم خدمات متكاملة تجمع بين الاستشارات النفسية والأسرية وعلاج الإدمان',
  },
  clinics: {
    tag: 'عياداتنا',
    titlePrefix: 'عيادات',
    titleHighlight: 'متخصصة',
    titleSuffix: '',
    subtitle: 'كل عيادة صُممت لتغطية احتياج محدد',
  },
  supportGroups: {
    tag: 'مجموعات الدعم',
    titlePrefix: 'مجموعات دعم',
    titleHighlight: 'متخصصة',
    titleSuffix: '',
    subtitle: 'بيئة آمنة للمشاركة والتعافي مع مجموعة صغيرة بإشراف متخصصين',
  },
  team: {
    tag: 'فريقنا',
    titlePrefix: 'خبراء',
    titleHighlight: 'في خدمتك',
    titleSuffix: '',
    subtitle: 'فريق من المتخصصين المؤهلين في الصحة النفسية والاستشارات الأسرية',
  },
  testimonials: {
    tag: 'آراء عملائنا',
    titlePrefix: 'ماذا يقول',
    titleHighlight: 'عملاؤنا؟',
    titleSuffix: '',
    subtitle: 'تجارب حقيقية من أشخاص بدأوا رحلة تعافيهم معنا',
  },
  blog: {
    tag: 'المدونة',
    titlePrefix: 'مقالات',
    titleHighlight: 'ونصائح',
    titleSuffix: '',
    subtitle: 'محتوى متخصص من فريقنا لمساعدتك على فهم نفسك وتطوير حياتك',
  },
  faq: {
    tag: 'الأسئلة الشائعة',
    titlePrefix: 'أسئلة',
    titleHighlight: 'يطرحها الكثير',
    titleSuffix: '',
    subtitle: 'إجابات سريعة عن أكثر ما يهمّك قبل حجز موعدك',
  },
  cta: {
    tag: 'ابدأ رحلتك',
    titlePrefix: 'جاهزون',
    titleHighlight: 'لمساعدتك',
    titleSuffix: '',
    subtitle: 'فريقنا جاهز لمساعدتك — سرية تامة',
  },
};

export const SECTION_INTRO_DEFAULTS_EN: HomeSectionIntros = {
  features: {
    tag: 'Our Features',
    titlePrefix: 'Everything for your',
    titleHighlight: 'mental health',
    titleSuffix: 'in one place',
    subtitle: 'We offer integrated services combining psychological & family counseling and addiction recovery',
  },
  clinics: {
    tag: 'Our Clinics',
    titlePrefix: 'Specialized',
    titleHighlight: 'clinics',
    titleSuffix: '',
    subtitle: 'Each clinic is designed to address a specific need at the highest quality',
  },
  supportGroups: {
    tag: 'Support Groups',
    titlePrefix: 'Specialized',
    titleHighlight: 'support groups',
    titleSuffix: '',
    subtitle: 'A safe space to share and recover in a small group led by specialists',
  },
  team: {
    tag: 'Our Team',
    titlePrefix: 'Experts',
    titleHighlight: 'at your service',
    titleSuffix: '',
    subtitle: 'A team of qualified specialists in mental health and family counseling',
  },
  testimonials: {
    tag: 'Client Reviews',
    titlePrefix: 'What our',
    titleHighlight: 'clients say',
    titleSuffix: '',
    subtitle: 'Real stories from people who began their recovery journey with us',
  },
  blog: {
    tag: 'Blog',
    titlePrefix: 'Articles',
    titleHighlight: '& tips',
    titleSuffix: '',
    subtitle: 'Specialized content from our team to help you understand yourself and grow',
  },
  faq: {
    tag: 'FAQ',
    titlePrefix: 'Questions',
    titleHighlight: 'people often ask',
    titleSuffix: '',
    subtitle: 'Quick answers to what matters most before you book',
  },
  cta: {
    tag: 'Start your journey',
    titlePrefix: 'We are ready',
    titleHighlight: 'to help you',
    titleSuffix: '',
    subtitle: 'Our team is ready to help you — full confidentiality',
  },
};

export function resolveSectionIntros(locale: Locale = 'ar'): HomeSectionIntros {
  return locale === 'en' ? SECTION_INTRO_DEFAULTS_EN : SECTION_INTRO_DEFAULTS;
}
