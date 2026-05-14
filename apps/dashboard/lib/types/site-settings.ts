/**
 * Website CMS — site-settings types (key-value).
 */

export interface SiteSettingRow {
  key: string
  valueText: string | null
  valueAr: string | null
  valueEn: string | null
  valueJson: unknown
  valueMedia: string | null
}

export interface SiteSettingEntry {
  key: string
  valueText?: string | null
  valueAr?: string | null
  valueEn?: string | null
  valueJson?: unknown
  valueMedia?: string | null
}

export interface BulkUpsertSiteSettingsPayload {
  entries: SiteSettingEntry[]
}

export interface BulkUpsertResult {
  updated: number
}

/**
 * Hero section editable content (mirrored from website/features/site-content).
 * Each field maps to one SiteSetting row by a well-known key.
 */
export interface HeroFormValues {
  badgeText: string
  titlePrefix: string
  titleHighlight: string
  titleSuffix: string
  subtitle: string
  ctaPrimaryText: string
  ctaPrimaryHref: string
  ctaSecondaryText: string
  ctaSecondaryHref: string
  heroImageUrl: string
  badgeFloatTopLabel: string
  badgeFloatTopValue: string
  badgeFloatBottomLabel: string
  badgeFloatBottomValue: string
}

export const HERO_KEY_MAP: Record<keyof HeroFormValues, string> = {
  badgeText:             'home.hero.badge.ar',
  titlePrefix:           'home.hero.titlePrefix.ar',
  titleHighlight:        'home.hero.titleHighlight.ar',
  titleSuffix:           'home.hero.titleSuffix.ar',
  subtitle:              'home.hero.subtitle.ar',
  ctaPrimaryText:        'home.hero.ctaPrimary.text.ar',
  ctaPrimaryHref:        'home.hero.ctaPrimary.href',
  ctaSecondaryText:      'home.hero.ctaSecondary.text.ar',
  ctaSecondaryHref:      'home.hero.ctaSecondary.href',
  heroImageUrl:          'home.hero.heroImage',
  badgeFloatTopLabel:    'home.hero.badgeTop.label.ar',
  badgeFloatTopValue:    'home.hero.badgeTop.value.ar',
  badgeFloatBottomLabel: 'home.hero.badgeBottom.label.ar',
  badgeFloatBottomValue: 'home.hero.badgeBottom.value.ar',
}

export const HERO_DEFAULTS: HeroFormValues = {
  badgeText: 'مركز معتمد للاستشارات النفسية والأسرية',
  titlePrefix: 'رحلتك نحو',
  titleHighlight: 'السواء',
  titleSuffix: 'تبدأ اليوم',
  subtitle:
    'معالج يفهم ثقافتك، بيئة آمنة لا تحاسب، وسرّية مهنية تامة. جلسات حضورية في الرياض أو عن بُعد — متى ما كنت جاهزاً.',
  ctaPrimaryText: 'احجز موعدك',
  ctaPrimaryHref: '/booking',
  ctaSecondaryText: 'استكشف المعالجين',
  ctaSecondaryHref: '/therapists',
  heroImageUrl: '/images/hero.jpg',
  badgeFloatTopLabel: 'خبرة تتجاوز',
  badgeFloatTopValue: '15 عاماً',
  badgeFloatBottomLabel: 'مؤهلون من',
  badgeFloatBottomValue: 'هيئة التخصصات',
}

// ─── Privacy Policy ──────────────────────────────────────────────────────────

export interface PrivacyPolicyFormValues {
  ar: string
  en: string
}

export const PRIVACY_POLICY_KEY_AR   = 'legal.privacy.ar'
export const PRIVACY_POLICY_KEY_EN   = 'legal.privacy.en'
export const PRIVACY_POLICY_KEY_DATE = 'legal.privacy.updatedAt'

export const PRIVACY_POLICY_DEFAULTS: PrivacyPolicyFormValues = {
  ar: `سياسة الخصوصية

نحن ملتزمون بحماية خصوصيتك وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية.

١. البيانات التي نجمعها
- الاسم الأول والأخير
- البريد الإلكتروني
- رقم الهاتف (اختياري)
- تاريخ المواعيد والجلسات
- صور وثائق الدفع (عند اختيار التحويل البنكي)
- معرّف الجهاز لأغراض الإشعارات الفورية

٢. الغرض من الجمع
نستخدم هذه البيانات لـ: تقديم خدمات الحجز والجلسات، التواصل معك بشأن مواعيدك، معالجة المدفوعات، وإرسال الإشعارات ذات الصلة.

٣. مشاركة البيانات
لا نبيع بياناتك. قد نشاركها مع: مزوّدي معالجة المدفوعات (بوّابات الدفع المرخّصة)، خدمات الإشعارات (FCM)، وخدمات مؤتمرات الفيديو — وذلك بالقدر اللازم فقط لتقديم الخدمة.

٤. الاحتفاظ بالبيانات
نحتفظ ببياناتك طوال فترة نشاط حسابك. يمكنك طلب الحذف في أي وقت.

٥. حقوقك
وفقاً لنظام حماية البيانات الشخصية، يحق لك: الاطلاع على بياناتك، تصحيحها، طلب حذفها، أو الاعتراض على معالجتها. للتواصل: أرسل طلبك عبر التطبيق أو تواصل مع فريق الدعم.

٦. الأمان
نستخدم تشفير TLS أثناء النقل وتشفير قاعدة البيانات في حالة السكون لحماية بياناتك.

٧. التعديلات
نُخطرك بأي تغييرات جوهرية عبر التطبيق أو البريد الإلكتروني قبل نفاذها بـ 14 يوماً.`,
  en: `Privacy Policy

We are committed to protecting your privacy in compliance with the Saudi Personal Data Protection Law (PDPL).

1. Data We Collect
- First and last name
- Email address
- Phone number (optional)
- Appointment and session history
- Payment documents (when using bank transfer)
- Device identifier for push notifications

2. Purpose of Collection
We use this data to: deliver booking and session services, communicate with you about appointments, process payments, and send relevant notifications.

3. Data Sharing
We do not sell your data. We may share it with: licensed payment processors, notification services (FCM), and video conferencing providers — only as necessary to deliver the service.

4. Retention
We retain your data while your account is active. You may request deletion at any time.

5. Your Rights
Under the PDPL, you have the right to: access, correct, delete, or object to the processing of your data. Contact us via the app or our support team.

6. Security
We use TLS encryption in transit and database encryption at rest to protect your data.

7. Changes
We will notify you of material changes via the app or email at least 14 days before they take effect.`,
}

// ─── Home page section intros ─────────────────────────────────────────────────

/**
 * Home page section intros (Features/Clinics/Team/FAQ/Testimonials/Blog/SupportGroups/CTA).
 * Mirrors website/features/site-content/section-intros. Each section exposes the
 * same 5 editable fields.
 */
export interface SectionIntroValues {
  tag: string
  titlePrefix: string
  titleHighlight: string
  titleSuffix: string
  subtitle: string
}

export type SectionIntroKey =
  | 'features'
  | 'clinics'
  | 'supportGroups'
  | 'team'
  | 'testimonials'
  | 'blog'
  | 'faq'
  | 'cta'

export interface SectionIntrosFormValues {
  features:      SectionIntroValues
  clinics:       SectionIntroValues
  supportGroups: SectionIntroValues
  team:          SectionIntroValues
  testimonials:  SectionIntroValues
  blog:          SectionIntroValues
  faq:           SectionIntroValues
  cta:           SectionIntroValues
}

export const SECTION_INTRO_FIELDS = [
  'tag',
  'titlePrefix',
  'titleHighlight',
  'titleSuffix',
  'subtitle',
] as const satisfies readonly (keyof SectionIntroValues)[]

export const SECTION_INTRO_KEYS: readonly SectionIntroKey[] = [
  'features',
  'clinics',
  'supportGroups',
  'team',
  'testimonials',
  'blog',
  'faq',
  'cta',
]

export const SECTION_INTRO_LABELS: Record<SectionIntroKey, string> = {
  features:      'المميزات',
  clinics:       'العيادات',
  supportGroups: 'مجموعات الدعم',
  team:          'الفريق',
  testimonials:  'آراء العملاء',
  blog:          'المدونة',
  faq:           'الأسئلة الشائعة',
  cta:           'الدعوة للإجراء',
}

export function sectionIntroKey(
  section: SectionIntroKey,
  field: keyof SectionIntroValues,
): string {
  return `home.${section}.${field}.ar`
}

export const SECTION_INTRO_DEFAULTS: SectionIntrosFormValues = {
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
}
