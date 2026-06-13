export interface SupportGroup {
  slug: string;
  name: string;
  nameEn: string;
  desc: string;
  descEn: string;
  image: string;
  participants: string;
  sessions: string;
  format: string;
}

export const SUPPORT_GROUP_DEFAULTS: SupportGroup[] = [
  { slug: 'art-therapy', name: 'العلاج بالفن', nameEn: 'Art Therapy', desc: 'التعبير الإبداعي لمعالجة المشاعر عبر الرسم والألوان في بيئة جماعية آمنة', descEn: 'Creative expression to process emotions through drawing and color in a safe group setting', image: '/images/support-groups/art-therapy.jpg', participants: '6-10 مشاركين', sessions: '8 جلسات', format: 'حضوري' },
  { slug: 'grief-loss', name: 'الحزن والفقد', nameEn: 'Grief & Loss', desc: 'دعم جماعي لمن فقدوا عزيزاً، ومساحة آمنة للتعبير والتعافي', descEn: 'Group support for those who have lost a loved one — a safe space to express and heal', image: '/images/support-groups/grief-loss.jpg', participants: '6-10 مشاركين', sessions: '10 جلسات', format: 'مختلط' },
  { slug: 'recovery-circle', name: 'دائرة التعافي', nameEn: 'Recovery Circle', desc: 'دعم مستمر للمتعافين من الإدمان وتعزيز الوقاية من الانتكاسة', descEn: 'Ongoing support for those recovering from addiction and strengthening relapse prevention', image: '/images/support-groups/recovery-circle.jpg', participants: '6-10 مشاركين', sessions: '12 جلسة', format: 'حضوري' },
  { slug: 'new-mothers', name: 'الأمهات الجدد', nameEn: 'New Mothers', desc: 'دعم ما بعد الولادة، اكتئاب الأمومة، وبناء الثقة بدور الأم', descEn: 'Postpartum support, maternal depression, and building confidence in the role of motherhood', image: '/images/support-groups/new-mothers.jpg', participants: '6-10 مشاركين', sessions: '6 جلسات', format: 'عن بُعد' },
  { slug: 'teen-support', name: 'دعم المراهقين', nameEn: 'Teen Support', desc: 'مهارات اجتماعية وبناء الهوية في مجموعة أقران من نفس الفئة', descEn: 'Social skills and identity building in a peer group of similar age', image: '/images/support-groups/teen-support.jpg', participants: '6-10 مشاركين', sessions: '8 جلسات', format: 'حضوري' },
  { slug: 'social-anxiety', name: 'القلق الاجتماعي', nameEn: 'Social Anxiety', desc: 'تدريب تدريجي على المواقف الاجتماعية في بيئة داعمة وآمنة', descEn: 'Gradual training on social situations in a safe and supportive environment', image: '/images/support-groups/social-anxiety.jpg', participants: '6-10 مشاركين', sessions: '10 جلسات', format: 'مختلط' },
];

export function resolveSupportGroups(): SupportGroup[] {
  return SUPPORT_GROUP_DEFAULTS;
}
