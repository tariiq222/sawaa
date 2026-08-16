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
  | 'services'
  | 'supportGroups'
  | 'team'
  | 'testimonials'
  | 'blog'
  | 'faq'
  | 'cta';

export interface HomeSectionIntros {
  features: SectionIntro;
  services: SectionIntro;
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
  services: {
    tag: 'خدماتنا',
    titlePrefix: 'خدمات',
    titleHighlight: 'متاحة للحجز',
    titleSuffix: '',
    subtitle: 'اختر الخدمة المناسبة لاحتياجك، وتعرّف على مدتها وتكلفتها، ثم أكمل الحجز مع أحد مختصينا.',
  },
  supportGroups: {
    tag: 'البرامج الجماعية',
    titlePrefix: 'برامج جماعية',
    titleHighlight: 'تنمو معك',
    titleSuffix: '',
    subtitle: 'استكشف البرامج المنشورة من المركز، وتعرّف على موعدها ومدتها ومقاعدها قبل الانضمام.',
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
  services: {
    tag: 'Our Services',
    titlePrefix: 'Services',
    titleHighlight: 'available to book',
    titleSuffix: '',
    subtitle: 'Choose the service that fits your needs, review its duration and price, then continue booking with one of our specialists.',
  },
  supportGroups: {
    tag: 'Group Programs',
    titlePrefix: 'Group programs',
    titleHighlight: 'that grow with you',
    titleSuffix: '',
    subtitle: 'Explore programs published by the center, including schedules, duration, and available seats.',
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
