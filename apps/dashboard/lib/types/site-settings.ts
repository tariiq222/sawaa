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

// ─── Blog Posts (valueJson) ──────────────────────────────────────────────────

export interface BlogPostItem {
  slug: string
  title: string
  titleEn: string
  date: string
  tag: string
  tagEn: string
  author: string | null
  image: string
  content: string
}

export const BLOG_POSTS_KEY = 'content.blog.posts'

export const BLOG_POST_DEFAULTS: BlogPostItem[] = [
  { slug: 'post-1', title: 'بـ 6 خطوات استعد إيقاع حياتك بعد الإجازة', titleEn: 'In 6 Steps: Restore Your Life Rhythm After the Holiday', date: 'أبريل 2025', tag: 'علم اجتماع', tagEn: 'Sociology', author: null, image: '/images/blog/post-1.webp', content: '' },
  { slug: 'post-2', title: 'لماذا القلق والتوتر أخطر ما يمر به الإنسان؟', titleEn: 'Why Anxiety and Stress Are Among the Most Dangerous Things We Face', date: 'مارس 2025', tag: 'علم النفس', tagEn: 'Psychology', author: 'د. عهود الشلهوب', image: '/images/blog/post-2.webp', content: '' },
  { slug: 'post-3', title: 'الاحتراق الوظيفي: كيف تتعرف عليه وتتعامل معه', titleEn: 'Job Burnout: How to Recognize and Manage It', date: 'أكتوبر 2024', tag: 'علم النفس', tagEn: 'Psychology', author: 'د. عهود الشلهوب', image: '/images/blog/post-3.webp', content: '' },
]

// ─── FAQ Items (valueJson) ───────────────────────────────────────────────────

export interface FaqItem {
  q: string
  qEn: string
  a: string
  aEn: string
}

export const FAQ_ITEMS_KEY = 'content.faq.items'

export const FAQ_DEFAULTS: FaqItem[] = [
  { q: 'كم تكلفة الجلسة؟', qEn: 'How much does a session cost?', a: 'تختلف تكلفة الجلسة حسب نوع الاستشارة والمعالج. للاطلاع على الأسعار التفصيلية يمكنك التواصل معنا أو زيارة صفحة الحجز.', aEn: 'Session pricing varies by consultation type and therapist. For detailed pricing, please contact us or visit the booking page.' },
  { q: 'هل تقبلون التأمين الطبي؟', qEn: 'Do you accept medical insurance?', a: 'نعمل حالياً على توسيع شبكة شركاء التأمين. تواصل معنا للاستفسار عن آخر التحديثات بخصوص شركة التأمين الخاصة بك.', aEn: 'We are currently expanding our insurance partner network. Please contact us for the latest update on your insurance provider.' },
  { q: 'هل الجلسات سرية تماماً؟', qEn: 'Are sessions fully confidential?', a: 'نعم — جميع الجلسات والبيانات محمية بسرية مهنية مطلقة وفق معايير الهيئة السعودية للتخصصات الصحية. لا تُشارك أي معلومات مع أي طرف دون إذنك الصريح.', aEn: 'Yes — all sessions and data are protected under strict professional confidentiality per Saudi Commission for Health Specialties standards. No information is shared with any party without your explicit consent.' },
  { q: 'كم تستغرق الجلسة الواحدة؟', qEn: 'How long does a single session take?', a: 'الجلسة الاعتيادية 45 دقيقة، وقد تختلف حسب نوع الاستشارة وتوصية المعالج.', aEn: 'A standard session is 45 minutes and may vary depending on the consultation type and your therapist\'s recommendation.' },
  { q: 'ما الفرق بين الجلسة الحضورية وعن بُعد؟', qEn: 'What is the difference between in-person and remote sessions?', a: 'الحضورية في مقر العيادة بالرياض، وعن بُعد عبر منصة آمنة مشفّرة من أي مكان. كلاهما بنفس الجودة والكفاءة العلاجية.', aEn: 'In-person sessions take place at our clinic in Riyadh; remote sessions run on a secure, encrypted platform from anywhere. Both deliver the same therapeutic quality and effectiveness.' },
  { q: 'كيف تكون الجلسة الأولى؟', qEn: 'What is the first session like?', a: 'تقييم أولي يستمع فيه المعالج لاحتياجاتك ويبني خطة علاجية مناسبة لك. لا التزام بعدد جلسات محدد — أنت تقرر.', aEn: 'An initial assessment where the therapist listens to your needs and builds a treatment plan suited to you. No commitment to a fixed number of sessions — you decide.' },
]

// ─── Support Groups (valueJson) ──────────────────────────────────────────────

export interface SupportGroupItem {
  slug: string
  name: string
  nameEn: string
  desc: string
  descEn: string
  image: string
  participants: string
  sessions: string
  format: string
}

export const SUPPORT_GROUPS_KEY = 'content.supportGroups.items'

export const SUPPORT_GROUP_DEFAULTS: SupportGroupItem[] = [
  { slug: 'art-therapy', name: 'العلاج بالفن', nameEn: 'Art Therapy', desc: 'التعبير الإبداعي لمعالجة المشاعر عبر الرسم والألوان في بيئة جماعية آمنة', descEn: 'Creative expression to process emotions through drawing and color in a safe group setting', image: '/images/support-groups/art-therapy.jpg', participants: '6-10 مشاركين', sessions: '8 جلسات', format: 'حضوري' },
  { slug: 'grief-loss', name: 'الحزن والفقد', nameEn: 'Grief & Loss', desc: 'دعم جماعي لمن فقدوا عزيزاً، ومساحة آمنة للتعبير والتعافي', descEn: 'Group support for those who have lost a loved one — a safe space to express and heal', image: '/images/support-groups/grief-loss.jpg', participants: '6-10 مشاركين', sessions: '10 جلسات', format: 'مختلط' },
  { slug: 'recovery-circle', name: 'دائرة التعافي', nameEn: 'Recovery Circle', desc: 'دعم مستمر للمتعافين من الإدمان وتعزيز الوقاية من الانتكاسة', descEn: 'Ongoing support for those recovering from addiction and strengthening relapse prevention', image: '/images/support-groups/recovery-circle.jpg', participants: '6-10 مشاركين', sessions: '12 جلسة', format: 'حضوري' },
  { slug: 'new-mothers', name: 'الأمهات الجدد', nameEn: 'New Mothers', desc: 'دعم ما بعد الولادة، اكتئاب الأمومة، وبناء الثقة بدور الأم', descEn: 'Postpartum support, maternal depression, and building confidence in the role of motherhood', image: '/images/support-groups/new-mothers.jpg', participants: '6-10 مشاركين', sessions: '6 جلسات', format: 'عن بُعد' },
  { slug: 'teen-support', name: 'دعم المراهقين', nameEn: 'Teen Support', desc: 'مهارات اجتماعية وبناء الهوية في مجموعة أقران من نفس الفئة', descEn: 'Social skills and identity building in a peer group of similar age', image: '/images/support-groups/teen-support.jpg', participants: '6-10 مشاركين', sessions: '8 جلسات', format: 'حضوري' },
  { slug: 'social-anxiety', name: 'القلق الاجتماعي', nameEn: 'Social Anxiety', desc: 'تدريب تدريجي على المواقف الاجتماعية في بيئة داعمة وآمنة', descEn: 'Gradual training on social situations in a safe and supportive environment', image: '/images/support-groups/social-anxiety.jpg', participants: '6-10 مشاركين', sessions: '10 جلسات', format: 'مختلط' },
]

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
