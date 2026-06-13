export interface BlogPost {
  slug: string;
  title: string;
  titleEn: string;
  date: string;
  tag: string;
  tagEn: string;
  author: string | null;
  image: string;
  content: string;
}

export const BLOG_POST_DEFAULTS: BlogPost[] = [
  { slug: 'post-1', title: 'بـ 6 خطوات استعد إيقاع حياتك بعد الإجازة', titleEn: 'In 6 Steps: Restore Your Life Rhythm After the Holiday', date: 'أبريل 2025', tag: 'علم اجتماع', tagEn: 'Sociology', author: null, image: '/images/blog/post-1.webp', content: '' },
  { slug: 'post-2', title: 'لماذا القلق والتوتر أخطر ما يمر به الإنسان؟', titleEn: 'Why Anxiety and Stress Are Among the Most Dangerous Things We Face', date: 'مارس 2025', tag: 'علم النفس', tagEn: 'Psychology', author: 'د. عهود الشلهوب', image: '/images/blog/post-2.webp', content: '' },
  { slug: 'post-3', title: 'الاحتراق الوظيفي: كيف تتعرف عليه وتتعامل معه', titleEn: 'Job Burnout: How to Recognize and Manage It', date: 'أكتوبر 2024', tag: 'علم النفس', tagEn: 'Psychology', author: 'د. عهود الشلهوب', image: '/images/blog/post-3.webp', content: '' },
];

export function resolveBlogPosts(): BlogPost[] {
  return BLOG_POST_DEFAULTS;
}
