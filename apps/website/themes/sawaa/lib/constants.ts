import type { Clinic, Therapist, BlogPost, Testimonial, SupportGroup, FaqItem } from './types';

export const SITE = {
  name: 'مركز سواء',
  nameShort: 'مركز سواء للاستشارات الأسرية',
  desc: 'مركز متخصص في الاستشارات النفسية والأسرية وعلاج الإدمان بسرية تامة وكوادر سعودية مؤهلة.',
  nameEn: 'Sawa Center',
  nameShortEn: 'Sawa Family Counseling Center',
  descEn: 'A specialized center for family and psychological counseling and addiction treatment with full confidentiality and qualified Saudi staff.',
  logo: '/logos/sawa-logo.png',
  logoWhite: '/logos/sawa-logo-white.png',
  logoDark: '/logos/sawa-logo.png',
  heroImage: '/images/hero.jpg',
  phone: '0558446605',
  email: 'support@sawaa.sa',
  address: 'الرياض، شارع تركي الأول، حي المحمدية',
  addressEn: 'Riyadh, Turki Al-Awwal Street, Al-Muhammadiyah district',
  social: {
    tiktok: 'https://www.tiktok.com/@sawa_center',
    x: 'https://x.com/sawaa_co',
    instagram: 'https://www.instagram.com/sawaa.co/',
    youtube: 'https://www.youtube.com/channel/UCmyB91xiXERIJvHLt3TszBw',
  },
};

export const NAV_LINKS = [
  { label: 'الرئيسية', href: '/' },
  { label: 'المعالجون', href: '/therapists' },
  { label: 'مجموعات الدعم', href: '/support-groups' },
  { label: 'اختبار الإرهاق', href: '/burnout-test' },
  { label: 'اتصل بنا', href: '/contact' },
];

export const STATS = [
  { num: '+1500', label: 'أسرة مستفيدة',     labelEn: 'Families helped' },
  { num: '+20',   label: 'خبير متخصص',       labelEn: 'Specialists' },
  { num: '%97',   label: 'نسبة رضا العملاء', labelEn: 'Client satisfaction' },
];

export const CLINICS: Clinic[] = [
  { slug: 'specialists',  name: 'استشارات الأخصائيين',  nameEn: 'Specialist Consultations',  desc: 'إشراف عيادي عن بُعد لتبادل الخبرات والاستشارات المهنية بين المتخصصين', descEn: 'Remote clinical supervision for knowledge sharing and professional consultations between specialists', icon: 'Users',         image: '/images/clinics/specialists.webp' },
  { slug: 'wellness',     name: 'عيادة العافية',         nameEn: 'Wellness Clinic',            desc: 'دعم الموظفين والمتقاعدين في التعامل مع ضغوط العمل واستعادة التوازن',      descEn: 'Supporting employees and retirees in managing work stress and restoring balance', icon: 'Heart',         image: '/images/clinics/wellness.webp' },
  { slug: 'support',      name: 'عيادة الدعم والمواساة', nameEn: 'Support & Comfort Clinic',   desc: 'مساندة المتضررين من الصدمات النفسية والأزمات بأساليب علمية متخصصة',     descEn: 'Helping those affected by psychological trauma and crises with specialized evidence-based methods', icon: 'HandHeart',     image: '/images/clinics/support.webp' },
  { slug: 'growth',       name: 'عيادة النمو والتطوير',  nameEn: 'Growth & Development Clinic', desc: 'رعاية نفسية متخصصة للأطفال والمراهقين دون 16 عاماً ودعم نموهم',           descEn: 'Specialized psychological care for children and teens under 16 to support their development', icon: 'Baby',          image: '/images/clinics/growth.webp' },
  { slug: 'happiness',    name: 'عيادة السعادة',          nameEn: 'Happiness Clinic',           desc: 'استشارات زوجية وأسرية لبناء علاقات صحية ومستقرة وحل النزاعات',           descEn: 'Couple and family counseling to build healthy, stable relationships and resolve conflicts', icon: 'Smile',         image: '/images/clinics/happiness.webp' },
  { slug: 'adaptation',   name: 'عيادة التوافق والتكيف',  nameEn: 'Adaptation & Adjustment Clinic', desc: 'علاج الاضطرابات النفسية وتحسين الشخصية والتكيف مع تحديات الحياة',     descEn: 'Treating psychological disorders, improving personality, and adapting to life challenges', icon: 'Brain',         image: '/images/clinics/adaptation.webp' },
  { slug: 'measurement',  name: 'عيادة القياس والتقويم',  nameEn: 'Assessment & Evaluation Clinic', desc: 'اختبارات نفسية معتمدة تشمل MMPI واختبارات الذكاء والشخصية المقننة',  descEn: 'Accredited psychological assessments including MMPI, IQ, and standardized personality tests', icon: 'ClipboardList', image: '/images/clinics/measurement.webp' },
  { slug: 'change',       name: 'عيادة التحفيز والتغيير', nameEn: 'Motivation & Change Clinic', desc: 'علاج الإدمان والسلوكيات الخطرة بمنهجيات علمية حديثة وبرامج تعافي',       descEn: 'Addiction and high-risk behavior treatment using modern scientific methods and recovery programs', icon: 'RefreshCw',     image: '/images/clinics/change.webp' },
];

export const SUPPORT_GROUPS: SupportGroup[] = [
  { slug: 'art-therapy',    name: 'العلاج بالفن',    nameEn: 'Art Therapy',        desc: 'التعبير الإبداعي لمعالجة المشاعر عبر الرسم والألوان في بيئة جماعية آمنة',    descEn: 'Creative expression to process emotions through drawing and color in a safe group setting',     icon: 'Palette',     image: '/images/support-groups/art-therapy.jpg',    participants: '6-10 مشاركين', participantsEn: '6-10 participants', sessions: '8 جلسات',  sessionsEn: '8 sessions',  format: 'حضوري',  formatEn: 'In-person' },
  { slug: 'grief-loss',     name: 'الحزن والفقد',    nameEn: 'Grief & Loss',       desc: 'دعم جماعي لمن فقدوا عزيزاً، ومساحة آمنة للتعبير والتعافي',                  descEn: 'Group support for those who have lost a loved one — a safe space to express and heal',          icon: 'HeartCrack',  image: '/images/support-groups/grief-loss.jpg',     participants: '6-10 مشاركين', participantsEn: '6-10 participants', sessions: '10 جلسات', sessionsEn: '10 sessions', format: 'مختلط',  formatEn: 'Hybrid' },
  { slug: 'recovery-circle',name: 'دائرة التعافي',   nameEn: 'Recovery Circle',    desc: 'دعم مستمر للمتعافين من الإدمان وتعزيز الوقاية من الانتكاسة',                 descEn: 'Ongoing support for those recovering from addiction and strengthening relapse prevention',      icon: 'RefreshCw',   image: '/images/support-groups/recovery-circle.jpg',participants: '6-10 مشاركين', participantsEn: '6-10 participants', sessions: '12 جلسة',  sessionsEn: '12 sessions', format: 'حضوري',  formatEn: 'In-person' },
  { slug: 'new-mothers',    name: 'الأمهات الجدد',   nameEn: 'New Mothers',        desc: 'دعم ما بعد الولادة، اكتئاب الأمومة، وبناء الثقة بدور الأم',                  descEn: 'Postpartum support, maternal depression, and building confidence in the role of motherhood',    icon: 'Baby',        image: '/images/support-groups/new-mothers.jpg',    participants: '6-10 مشاركين', participantsEn: '6-10 participants', sessions: '6 جلسات',  sessionsEn: '6 sessions',  format: 'عن بُعد', formatEn: 'Remote' },
  { slug: 'teen-support',   name: 'دعم المراهقين',   nameEn: 'Teen Support',       desc: 'مهارات اجتماعية وبناء الهوية في مجموعة أقران من نفس الفئة',                 descEn: 'Social skills and identity building in a peer group of similar age',                            icon: 'Users',       image: '/images/support-groups/teen-support.jpg',   participants: '6-10 مشاركين', participantsEn: '6-10 participants', sessions: '8 جلسات',  sessionsEn: '8 sessions',  format: 'حضوري',  formatEn: 'In-person' },
  { slug: 'social-anxiety', name: 'القلق الاجتماعي', nameEn: 'Social Anxiety',     desc: 'تدريب تدريجي على المواقف الاجتماعية في بيئة داعمة وآمنة',                   descEn: 'Gradual training on social situations in a safe and supportive environment',                    icon: 'UsersRound',  image: '/images/support-groups/social-anxiety.jpg', participants: '6-10 مشاركين', participantsEn: '6-10 participants', sessions: '10 جلسات', sessionsEn: '10 sessions', format: 'مختلط',  formatEn: 'Hybrid' },
];

export const THERAPISTS: Therapist[] = [
  { slug: 'aisha-hijazi',         clinicSlugs: ['adaptation'],              name: 'د. عائشة حجازي',     nameEn: 'Dr. Aisha Hijazi',         role: 'أستاذ مشارك استشاري',          roleEn: 'Associate Professor & Consultant', badge: 'أستاذ مشارك', exp: '+20 سنة', letter: 'ع' },
  { slug: 'ohoud-alshalhoub',     clinicSlugs: ['growth', 'support'],       name: 'د. عهود الشلهوب',    nameEn: 'Dr. Ohoud Alshalhoub',     role: 'استشاري علم النفس',            roleEn: 'Psychology Consultant',            badge: 'استشاري',   exp: '+15 سنة', letter: 'ع' },
  { slug: 'majed-alharbi',        clinicSlugs: ['adaptation', 'happiness'], name: 'د. ماجد الحربي',     nameEn: 'Dr. Majed Alharbi',        role: 'استشاري نفسي',                 roleEn: 'Psychological Consultant',         badge: 'استشاري',   exp: '+15 سنة', letter: 'م', image: '/images/team/majed-h.webp' },
  { slug: 'fahad-alharbi',        clinicSlugs: ['adaptation'],              name: 'د. فهد الحربي',      nameEn: 'Dr. Fahad Alharbi',        role: 'أخصائي أول علم النفس العيادي', roleEn: 'Senior Clinical Psychologist',     badge: 'أخصائي أول',exp: '+15 سنة', letter: 'ف', image: '/images/team/fahad.webp' },
  { slug: 'mohammad-ouda',        clinicSlugs: ['support'],                 name: 'د. محمد عودة',       nameEn: 'Dr. Mohammad Ouda',        role: 'أخصائي نفسي',                  roleEn: 'Psychologist',                     badge: 'أخصائي',    exp: '+30 سنة', letter: 'م' },
  { slug: 'bandar-alelm',         clinicSlugs: ['adaptation'],              name: 'د. بندر العلم',      nameEn: 'Dr. Bandar Alelm',         role: 'استشاري علم النفس',            roleEn: 'Psychology Consultant',            badge: 'استشاري',   exp: '+10 سنوات', letter: 'ب' },
  { slug: 'noura-alanazi',        clinicSlugs: ['happiness'],               name: 'د. نورة العنزي',     nameEn: 'Dr. Noura Alanazi',        role: 'أخصائي اجتماعي أول',           roleEn: 'Senior Social Worker',             badge: 'أخصائي أول',exp: '+12 سنة', letter: 'ن' },
  { slug: 'fayzah-alanazi',       clinicSlugs: ['happiness'],               name: 'د. فايزة العنزي',    nameEn: 'Dr. Fayzah Alanazi',       role: 'استشاري اجتماعي',              roleEn: 'Social Consultant',                badge: 'استشاري',   exp: '+15 سنة', letter: 'ف' },
  { slug: 'noura-aldawood',       clinicSlugs: ['happiness', 'adaptation'], name: 'د. نورة سعد الداود', nameEn: 'Dr. Noura Saad Aldawood',  role: 'استشاري اجتماعي',              roleEn: 'Social Consultant',                badge: 'استشاري',   exp: '+15 سنة', letter: 'ن' },
  { slug: 'sara-aljebreen',       clinicSlugs: ['wellness'],                name: 'أ. سارة الجبرين',    nameEn: 'Ms. Sara Aljebreen',       role: 'أخصائي نفسي',                  roleEn: 'Psychologist',                     badge: 'أخصائي',    exp: '+7 سنوات', letter: 'س' },
  { slug: 'amal-alhousawi',       clinicSlugs: ['wellness'],                name: 'أ. أمل الهوساوي',    nameEn: 'Ms. Amal Alhousawi',       role: 'أخصائي نفسي',                  roleEn: 'Psychologist',                     badge: 'أخصائي',    exp: '+15 سنة', letter: 'أ', image: '/images/team/amal.webp' },
  { slug: 'najia-alabbasi',       clinicSlugs: ['wellness'],                name: 'أ. ناجية العباسي',   nameEn: 'Ms. Najia Alabbasi',       role: 'أخصائي نفسي',                  roleEn: 'Psychologist',                     badge: 'أخصائي',    exp: '+10 سنوات', letter: 'ن', image: '/images/team/najia.webp' },
  { slug: 'khaled-alanazi',       clinicSlugs: ['change'],                  name: 'أ. خالد العنزي',     nameEn: 'Mr. Khaled Alanazi',       role: 'أخصائي اجتماعي أول',           roleEn: 'Senior Social Worker',             badge: 'أخصائي أول',exp: '+30 سنة', letter: 'خ' },
  { slug: 'najeh-alanazi',        clinicSlugs: ['happiness'],               name: 'أ. ناجح العنزي',     nameEn: 'Mr. Najeh Alanazi',        role: 'أخصائي اجتماعي أول',           roleEn: 'Senior Social Worker',             badge: 'أخصائي أول',exp: '+15 سنة', letter: 'ن', image: '/images/team/najeh.webp' },
  { slug: 'nisreen-alsabban',     clinicSlugs: ['happiness'],               name: 'أ. نسرين الصبان',    nameEn: 'Ms. Nisreen Alsabban',     role: 'أخصائي اجتماعي أول',           roleEn: 'Senior Social Worker',             badge: 'أخصائي أول',exp: '+15 سنة', letter: 'ن', image: '/images/team/nisreen.webp' },
  { slug: 'majed-alfaisal',       clinicSlugs: ['change'],                  name: 'أ. ماجد الفيصل',     nameEn: 'Mr. Majed Alfaisal',       role: 'معالج إدمان',                  roleEn: 'Addiction Therapist',              badge: 'معالج',     exp: '+20 سنة', letter: 'م', image: '/images/team/majed-f.webp' },
  { slug: 'khaled-almohammad',    clinicSlugs: ['adaptation'],              name: 'أ. خالد المحمد',     nameEn: 'Mr. Khaled Almohammad',    role: 'أخصائي نفسي',                  roleEn: 'Psychologist',                     badge: 'أخصائي',    exp: '+15 سنة', letter: 'خ', image: '/images/team/khaled-m.webp' },
  { slug: 'doaa-alfadli',         clinicSlugs: ['wellness'],                name: 'أ. دعاء الفضلي',     nameEn: 'Ms. Doaa Alfadli',         role: 'أخصائي نفسي',                  roleEn: 'Psychologist',                     badge: 'أخصائي',    exp: '+5 سنوات', letter: 'د', image: '/images/team/doaa.webp' },
];

export const BLOG_POSTS: BlogPost[] = [
  { title: 'بـ 6 خطوات استعد إيقاع حياتك بعد الإجازة',    titleEn: 'In 6 Steps: Restore Your Life Rhythm After the Holiday', date: 'أبريل 2025',  tag: 'علم اجتماع', tagEn: 'Sociology',  image: '/images/blog/post-1.webp' },
  { title: 'لماذا القلق والتوتر أخطر ما يمر به الإنسان؟', titleEn: 'Why Anxiety and Stress Are Among the Most Dangerous Things We Face', date: 'مارس 2025',   author: 'د. عهود الشلهوب', tag: 'علم النفس', tagEn: 'Psychology', image: '/images/blog/post-2.webp' },
  { title: 'الاحتراق الوظيفي: كيف تتعرف عليه وتتعامل معه', titleEn: 'Job Burnout: How to Recognize and Manage It', date: 'أكتوبر 2024', author: 'د. عهود الشلهوب', tag: 'علم النفس', tagEn: 'Psychology', image: '/images/blog/post-3.webp' },
];

export const TESTIMONIALS: Testimonial[] = [
  { text: 'مركز فيه جهود جبارة ورائعة، أخص بالذكر الدكتورة عهود التي قدمت لنا دعماً استثنائياً ومهنية عالية.', textEn: 'An amazing center with tremendous efforts — special thanks to Dr. Ohoud who gave us exceptional support and high professionalism.', name: 'أبو يامن',      nameEn: 'Abu Yamen',     label: 'عميل', labelEn: 'Client', letter: 'أ' },
  { text: 'من أفضل المراكز صحياً ونفسياً، الابتسامة ما تفارقهم والتعامل راقي جداً. أنصح الجميع.',               textEn: 'One of the best health and mental wellness centers — they never lose their smile and the service is top-class. I recommend it to everyone.', name: 'متعب الحربي',   nameEn: 'Mutaib Alharbi', label: 'عميل', labelEn: 'Client', letter: 'م' },
  { text: 'مركز تخصصي واعد، راقي ومريح. البيئة مهيأة ممتاز والفريق محترف ومتعاون.',                            textEn: 'A promising specialist center — refined and comfortable. The environment is excellently prepared and the team is professional and cooperative.', name: 'Moutaz Ali',    nameEn: 'Moutaz Ali',    label: 'عميل', labelEn: 'Client', letter: 'M' },
];

export const FAQS: FaqItem[] = [
  { q: 'كم تكلفة الجلسة؟',               qEn: 'How much does a session cost?',                   a: 'تختلف تكلفة الجلسة حسب نوع الاستشارة والمعالج. للاطلاع على الأسعار التفصيلية يمكنك التواصل معنا أو زيارة صفحة الحجز.', aEn: 'Session pricing varies by consultation type and therapist. For detailed pricing, please contact us or visit the booking page.' },
  { q: 'هل تقبلون التأمين الطبي؟',       qEn: 'Do you accept medical insurance?',                a: 'نعمل حالياً على توسيع شبكة شركاء التأمين. تواصل معنا للاستفسار عن آخر التحديثات بخصوص شركة التأمين الخاصة بك.', aEn: 'We are currently expanding our insurance partner network. Please contact us for the latest update on your insurance provider.' },
  { q: 'هل الجلسات سرية تماماً؟',        qEn: 'Are sessions fully confidential?',                a: 'نعم — جميع الجلسات والبيانات محمية بسرية مهنية مطلقة وفق معايير الهيئة السعودية للتخصصات الصحية. لا تُشارك أي معلومات مع أي طرف دون إذنك الصريح.', aEn: 'Yes — all sessions and data are protected under strict professional confidentiality per Saudi Commission for Health Specialties standards. No information is shared with any party without your explicit consent.' },
  { q: 'كم تستغرق الجلسة الواحدة؟',      qEn: 'How long does a single session take?',            a: 'الجلسة الاعتيادية 45 دقيقة، وقد تختلف حسب نوع الاستشارة وتوصية المعالج.', aEn: 'A standard session is 45 minutes and may vary depending on the consultation type and your therapist’s recommendation.' },
  { q: 'ما الفرق بين الجلسة الحضورية وعن بُعد؟', qEn: 'What is the difference between in-person and remote sessions?', a: 'الحضورية في مقر العيادة بالرياض، وعن بُعد عبر منصة آمنة مشفّرة من أي مكان. كلاهما بنفس الجودة والكفاءة العلاجية.', aEn: 'In-person sessions take place at our clinic in Riyadh; remote sessions run on a secure, encrypted platform from anywhere. Both deliver the same therapeutic quality and effectiveness.' },
  { q: 'كيف تكون الجلسة الأولى؟',        qEn: 'What is the first session like?',                 a: 'تقييم أولي يستمع فيه المعالج لاحتياجاتك ويبني خطة علاجية مناسبة لك. لا التزام بعدد جلسات محدد — أنت تقرر.', aEn: 'An initial assessment where the therapist listens to your needs and builds a treatment plan suited to you. No commitment to a fixed number of sessions — you decide.' },
];

export const PAYMENT_METHODS = [
  { name: 'tabby',      label: 'tabby',      src: '/logos/tabby.webp' },
  { name: 'tamara',     label: 'tamara',     src: '/logos/tamara.svg' },
  { name: 'mada',       label: 'مدى',        src: '/logos/mada.svg' },
  { name: 'visa',       label: 'Visa',       src: '/logos/visa.svg' },
  { name: 'mastercard', label: 'Mastercard', src: '/logos/mastercard.svg' },
  { name: 'apple-pay',  label: 'Apple Pay',  src: '/logos/apple-pay.svg' },
];

export function pickLocalized<T extends Record<string, unknown>>(
  entry: T,
  fields: (keyof T & string)[],
  locale: 'ar' | 'en',
): T {
  if (locale === 'ar') return entry;
  const out: Record<string, unknown> = { ...entry };
  for (const f of fields) {
    const enField = `${f}En` as keyof T & string;
    if (entry[enField] != null) out[f] = entry[enField];
  }
  return out as T;
}
