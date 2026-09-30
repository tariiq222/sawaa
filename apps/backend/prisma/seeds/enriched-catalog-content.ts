/* Local-only demo catalog content. Names and biographies are fictional examples;
 * do not present them as verified staff credentials. No payment rows are created here.
 * Entries must match rows that actually exist locally (matched by nameAr / slug);
 * nothing is created by the enrichment itself, and empty fields are filled only
 * when the row does not already carry copy in that language. */
import { join } from 'node:path';

// The backend's Prisma scripts run through tsx in its CommonJS package context.
export const DEMO_ASSET_DIR = join(__dirname, 'assets');
export const demoClinics = [
  { nameAr: 'الاستشارات الأسرية', nameEn: 'Family Counseling', descriptionAr: 'جلسات فردية وأسرية لفهم التوتر الأسري وتحسين التواصل بين أفراد الأسرة.', descriptionEn: 'Individual and family sessions that address household tension and improve communication between family members.', iconName: 'Users', asset: 'clinics/family.png' },
  { nameAr: 'القياس والتقويم', nameEn: 'Assessment', descriptionAr: 'مقاييس وفحوصات نفسية مقننة تدعم التشخيص وخطط الإرشاد.', descriptionEn: 'Standardised psychological tests and assessments that support diagnosis and counseling plans.', iconName: 'Brain', asset: 'clinics/psychological.png' },
  { nameAr: 'عيادة السعادة (اختبار محلي)', nameEn: 'Happiness Clinic (local test)', descriptionAr: 'عيادة تجريبية محلية للحجز المباشر عبر المختص دون اختيار خدمة.', descriptionEn: 'A local test clinic for direct booking through a practitioner without choosing a service.', iconName: 'Smile', asset: 'clinics/mental-health.png' },
] as const;

export const demoTherapists = [
  { slug: 'dr-sara-alqahtani-local', nameAr: 'د. سارة القحطاني', bioAr: 'متخصصة في مساعدة الأزواج والأسر على فهم أنماط التواصل وبناء حلول عملية.', bioEn: 'Works with couples and families to understand communication patterns and build practical solutions.', asset: 'therapists/sara.png' },
  { slug: 'dr-khalid-alotaibi-local', nameAr: 'د. خالد العتيبي', bioAr: 'يعمل مع البالغين والأسر بأسلوب عملي يركز على المهارات وتنظيم الضغوط.', bioEn: 'Works with adults and families using a practical approach focused on skills and managing stress.', asset: 'therapists/khalid.png' },
  { slug: 'dr-noura-alshehri-local', nameAr: 'د. نورة الشهري', bioAr: 'متخصصة في إرشاد الوالدين والتعامل مع تحديات الأطفال والمراهقين.', bioEn: 'Specialises in parenting guidance and supporting children and adolescents.', asset: 'therapists/noura.png' },
] as const;

export const demoPackages = [
  { nameAr: 'باقة التوازن الأسري', descriptionAr: 'أربع جلسات إرشاد أسري مع جلسة إضافية، للحضور أو الأونلاين.', descriptionEn: 'Four family counseling sessions plus one extra session, in person or online.', asset: 'packages/individual.png' },
  { nameAr: 'باقة بداية أفضل للزوجين', descriptionAr: 'ثلاث استشارات زوجية بسعر مخفّض، متاحة للحضور أو الأونلاين.', descriptionEn: 'Three couples consultations at a reduced price, available in person or online.', asset: 'packages/couples.png' },
] as const;

/** Individual services whose English copy is missing locally. Filled only when empty. */
export const demoServices = [
  { nameAr: 'جلسة إرشاد أسري', descriptionEn: 'A one-to-one session with a family counselor to work on communication and household tension.' },
  { nameAr: 'استشارة زوجية', descriptionEn: 'A couples session focused on clarifying disagreements and improving dialogue between partners.' },
  { nameAr: 'إرشاد الوالدين', descriptionEn: 'Guidance for parents on handling children’s behaviour and day-to-day parenting challenges.' },
] as const;

/** Program (group session) English copy. The Program model has no image column. */
export const demoPrograms = [
  { nameAr: 'برنامج مهارات التواصل الأسري', publicDescriptionEn: 'A group program that trains families in communication and listening skills.' },
  { nameAr: 'برنامج الوالدية الواعية', publicDescriptionEn: 'A group program for parents on mindful and consistent parenting practices.' },
] as const;

export const demoGroupAssets = [
  { serviceNameAr: 'العلاج بالفن', asset: 'groups/art.png' },
  { serviceNameAr: 'الحزن والفقد', asset: 'groups/grief.png' },
  { serviceNameAr: 'دائرة التعافي', asset: 'groups/recovery.png' },
  { serviceNameAr: 'الأمهات الجدد', asset: 'groups/mothers.png' },
  { serviceNameAr: 'دعم المراهقين', asset: 'groups/youth.png' },
  { serviceNameAr: 'القلق الاجتماعي', asset: 'groups/social.png' },
] as const;

export const demoAssets = [...demoClinics, ...demoTherapists, ...demoPackages, ...demoGroupAssets]
  .map(({ asset }) => asset);
