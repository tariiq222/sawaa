import type { SiteSettingsMap } from './types';

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
    subtitle: 'كل عيادة صُممت لتغطية احتياج محدد بأعلى جودة',
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
    subtitle: 'إجابات سريعة عن أكثر ما يهمّك قبل الحجز',
  },
  cta: {
    tag: 'ابدأ رحلتك',
    titlePrefix: 'جاهزون',
    titleHighlight: 'لمساعدتك',
    titleSuffix: '',
    subtitle: 'فريقنا جاهز لمساعدتك — سرية تامة',
  },
};

export const SECTION_INTRO_FIELDS = [
  'tag',
  'titlePrefix',
  'titleHighlight',
  'titleSuffix',
  'subtitle',
] as const satisfies readonly (keyof SectionIntro)[];

export const SECTION_INTRO_KEYS: readonly SectionIntroKey[] = [
  'features',
  'clinics',
  'supportGroups',
  'team',
  'testimonials',
  'blog',
  'faq',
  'cta',
];

export function settingKey(section: SectionIntroKey, field: keyof SectionIntro): string {
  return `home.${section}.${field}.ar`;
}

function pickText(map: SiteSettingsMap, key: string, fallback: string): string {
  const row = map.get(key);
  if (!row) return fallback;
  return row.valueAr ?? row.valueText ?? row.valueEn ?? fallback;
}

function resolveOne(
  map: SiteSettingsMap,
  section: SectionIntroKey,
  defaults: SectionIntro,
): SectionIntro {
  return {
    tag:            pickText(map, settingKey(section, 'tag'),            defaults.tag),
    titlePrefix:    pickText(map, settingKey(section, 'titlePrefix'),    defaults.titlePrefix),
    titleHighlight: pickText(map, settingKey(section, 'titleHighlight'), defaults.titleHighlight),
    titleSuffix:    pickText(map, settingKey(section, 'titleSuffix'),    defaults.titleSuffix),
    subtitle:       pickText(map, settingKey(section, 'subtitle'),       defaults.subtitle),
  };
}

export function resolveSectionIntros(map: SiteSettingsMap): HomeSectionIntros {
  return {
    features:      resolveOne(map, 'features',      SECTION_INTRO_DEFAULTS.features),
    clinics:       resolveOne(map, 'clinics',       SECTION_INTRO_DEFAULTS.clinics),
    supportGroups: resolveOne(map, 'supportGroups', SECTION_INTRO_DEFAULTS.supportGroups),
    team:          resolveOne(map, 'team',          SECTION_INTRO_DEFAULTS.team),
    testimonials:  resolveOne(map, 'testimonials',  SECTION_INTRO_DEFAULTS.testimonials),
    blog:          resolveOne(map, 'blog',          SECTION_INTRO_DEFAULTS.blog),
    faq:           resolveOne(map, 'faq',           SECTION_INTRO_DEFAULTS.faq),
    cta:           resolveOne(map, 'cta',           SECTION_INTRO_DEFAULTS.cta),
  };
}
