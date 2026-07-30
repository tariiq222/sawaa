export interface BlogPost {
  slug: string;
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  date: string;
  tag: string;
  tagEn: string;
  author: string | null;
  image: string;
  content: string;
}

/**
 * SEO keywords targeted across the blog corpus:
 *  - "استشارات أسرية الرياض" / "family counseling riyadh"
 *  - "علاج عن بعد" / "online therapy saudi"
 *  - "علاج نفسي" / "psychotherapy"
 *  - "صحة نفسية" / "mental health"
 *  - "احتراق وظيفي" / "job burnout"
 *  - "علاقات زوجية" / "marriage counseling"
 *
 * Titles + excerpts are written to lead with the searcher's actual query
 * phrasing (AR colloquial where natural) so the page reads well to a
 * human and to Google's BERT-style relevance scoring.
 *
 * Content is rendered through react-native-style paragraphs via newlines
 * inside the content string (the blog page splits on \n\n).
 */
export const BLOG_POST_DEFAULTS: BlogPost[] = [
  {
    slug: 'post-1',
    title: 'بـ 6 خطوات استعد إيقاع حياتك بعد الإجازة',
    titleEn: 'In 6 Steps: Restore Your Life Rhythm After the Holiday',
    excerpt:
      'العودة من الإجازة قد تكون مرهقة نفسياً. اكتشف الخطوات الست التي يستخدمها الأخصائيون في مركز سواء لإعادة إيقاع نومك وطاقتك بسرعة وأمان.',
    excerptEn:
      'Coming back from holiday can be mentally exhausting. Discover the six steps Sawa specialists use to reset your sleep and energy rhythm quickly and safely.',
    date: 'أبريل 2025',
    tag: 'علم النفس',
    tagEn: 'Psychology',
    author: 'د. عهود الشلهوب',
    image: '/images/blog/post-1.webp',
    content:
      'تبدأ المشكلة عادةً قبل يوم العودة: تذكّر أن «الأحد» سيحل بعد يومين فينقبض صدرك. هذا طبيعي تماماً — الانتقال من وضع الإجازة (حرية + استرخاء) إلى وضع العمل (انضباط + ضغط) يحتاج جسراً ذهنياً.\n\n' +
      'الخطوة الأولى: لا تستقبل الأسبوع بوراء كامل. خصّص آخر يومين من الإجازة للمهام الإدارية الخفيفة فقط (ترتيب البريد، تخطيط الأسبوع). هذا يجعل عودتك «تدرّجية» بدل «صدمة».\n\n' +
      'الخطوة الثانية: اضبط ساعتك البيولوجية قبل 48 ساعة من الدوام. استيقظ في نفس وقت الدوام، وتعرّض لضوء الشمس صباحاً — هذا يعيد إفراز الميلاتونين والكورتيزول إلى مسارهما الطبيعي.\n\n' +
      'الخطوة الثالثة: رتّب أول 30 دقيقة من يومك الأول. إذا دخلت المكتب بلا خطة، ستغرق في ردود الفعل. جهّز ثلاث مهام فقط واكتبها في ورقة beside جهازك.\n\n' +
      'الخطوة الرابعة: مارس رياضة خفيفة في يوم العودة (15 دقيقة مشي). الجسم المحروم من الحركة خلال الإجازة يحتاج «تنبيه» لطيف قبل أن يقبل الانضباط الذهني.\n\n' +
      'الخطوة الخامسة: لا تحاول «استرجاع» كل شيء دفعة واحدة. اختر مهمة واحدة فقط لأول يوم — استكمالها يمنحك دفعة من الثقة بدل الإرهاق.\n\n' +
      'الخطوة السادسة: إذا استمر شعورك بالإرهاق بعد أسبوعين، تواصل مع أخصائي. في مركز سواء للاستشارات الأسرية بالرياض نقدم جلسات فردية وجماعية تساعدك على استعادة التوازن باحترافية وسرية تامة.\n\n' +
      'ملاحظة: هذا المحتوى تعليمي ولا يُغني عن الاستشارة المتخصصة. للاستفسار: 011-XXX-XXXX.',
  },
  {
    slug: 'post-2',
    title: 'لماذا القلق والتوتر أخطر ما يمر به الإنسان؟',
    titleEn: 'Why Anxiety and Stress Are Among the Most Dangerous Things We Face',
    excerpt:
      'القلق المستمر ليس مجرد شعور — إنه حالة جسدية ونفسية تؤثر على القلب والمناعة والعلاقات. نستعرض في هذا المقال كيف يخدع القلق جسمك، ومتى يصبح خطراً يستدعي العلاج النفسي.',
    excerptEn:
      'Persistent anxiety is not just a feeling — it is a physical and psychological state that affects the heart, immunity, and relationships. In this article we review how anxiety deceives your body, and when it becomes dangerous enough to require psychotherapy.',
    date: 'مارس 2025',
    tag: 'علم النفس',
    tagEn: 'Psychology',
    author: 'د. عهود الشلهوب',
    image: '/images/blog/post-2.webp',
    content:
      'يخلط كثير من الناس بين «التوتر الطبيعي» و«اضطراب القلق». التوتر الطبيعي استجابة مؤقتة لتهديد: ترى وحشاً، يقفز قلبك، تبتعد، ينتهي الخطر، يعود جسمك لوضعه الطبيعي. أما القلق المرضي فيعمل بشكل مختلف: يبقى الجسم في حالة استنفار دائمة بلا سبب حقيقي، أو بسبب بسيط لا يستحق هذا المستوى من التنشيط.\n\n' +
      'الأثر الجسدي طويل المدى: ارتفاع ضغط الدم، ضعف المناعة، مشاكل الجهاز الهضمي، ألم عضلي مزمن، خفقان القلب، ضيق التنفس. هذه ليست أعراضاً نفسية فقط — إنها أعراض جسدية يسببها التوتر المستمر.\n\n' +
      'الأثر على العلاقات: الشخص القلق يتعب من حوله. يبحث عن تأكيد مستمر، يسيء تفسير اللامبالاة كإهمال، يدخل في جدالات صغيرة لا تنتهي. كثير من حالات الطلاق في الرياض سببها الحقيقي قلق مزمن غير معالج.\n\n' +
      'متى يصبح خطراً يستدعي العلاج؟ إذا كان القلق يمنعك من النوم، أو يجعلك تتجنب مناسبات اجتماعية، أو يدفعك لسلوكيات هروبية (إدمان، أكل مفرط، عزلة)، أو يؤثر على أدائك في العمل — فأنت مرشح واضح للاستشارة النفسية.\n\n' +
      'العلاج عن بعد أصبح خياراً فعالاً ومتوفراً في السعودية. في مركز سواء نقدم جلسات أونلاين عبر Zoom بأعلى معايير السرية، مع أخصائيين سعوديين مرخصين. لا داعي للانتظار حتى تتفاقم الأعراض.\n\n' +
      'ملاحظة: هذا المحتوى تعليمي ولا يُغني عن الاستشارة المتخصصة.',
  },
  {
    slug: 'post-3',
    title: 'الاحتراق الوظيفي: كيف تتعرف عليه وتتعامل معه',
    titleEn: 'Job Burnout: How to Recognize and Manage It',
    excerpt:
      'الاحتراق الوظيفي ليس «كسلاً» أو «قلة خبرة» — إنه استنزاف حقيقي للطاقة العاطفية والذهنية. علامات تحذيرية ستساعدك على اكتشافه مبكراً قبل أن يصل لمرحلة الإرهاق المزمن.',
    excerptEn:
      'Job burnout is not "laziness" or "inexperience" — it is a real depletion of emotional and mental energy. Warning signs that will help you detect it early before it reaches chronic exhaustion.',
    date: 'أكتوبر 2024',
    tag: 'علم النفس',
    tagEn: 'Psychology',
    author: 'د. عهود الشلهوب',
    image: '/images/blog/post-3.webp',
    content:
      'الاحتراق الوظيفي (Burnout) حالة موثقة علمياً منذ السبعينيات، لكنها زادت بشكل ملحوظ في السنوات الأخيرة — خاصة في بيئات العمل السعودية مع ضغط التحول الرقمي وزيادة ساعات العمل.\n\n' +
      'العلامات التحذيرية المبكرة: (1) الإرهاق صباحاً رغم النوم الكافي. (2) الشعور بالبرود تجاه العمل الذي كنت تستمتع به. (3) زيادة الأخطاء البسيطة والنسيان. (4) الشد العضلي المزمن (الرقبة، الكتفين، الظهر). (5) الانسحاب الاجتماعي المفاجئ. (6) شرب القهوة أو التدخين بشراهة أكبر.\n\n' +
      'الفرق بين الاحتراق والتعب العادي: التعب يزول مع الراحة. الاحتراق لا يزول مع إجازة قصيرة — بل يعود بمجرد عودتك للعمل. إذا أخذت إجازة وعُدت بنفس الشعور، فأنت في مرحلة متقدمة.\n\n' +
      'ما يجب تجنبه: إجبار نفسك على «تحمّل» أكثر. هذا يزيد الاحتراق سوءاً. أيضاً لا تترك العمل فجأة دون خطة بديلة — فجأة ستزيد الضغوط المالية والعلائقية.\n\n' +
      'ما ينفع فعلاً: (1) تحديد «ساعة الإيقاف» والالتزام بها. (2) تأكد من أخذ استراحات قصيرة بين المهام. (3) إعادة التواصل مع هواية أو نشاط ممتع أسبوعياً. (4) التحدث مع مديرك بشكل مباشر إذا كان جزء من الضغط قابلاً للتعديل. (5) الاستعانة بأخصائي نفسي لتقييم شدة الاحتراق ومنع تطوره لقلق أو اكتئاب.\n\n' +
      'في مركز سواء نقدم جلسات متخصصة في علاج الاحتراق الوظيفي، سواء حضورياً في الرياض أو عن بعد. جلسة استشارية واحدة قد تمنحك خارطة طريق واضحة للعودة لتوازنك.\n\n' +
      'ملاحظة: هذا المحتوى تعليمي ولا يُغني عن الاستشارة المتخصصة.',
  },
];

/**
 * Lightweight in-memory excerpt for the blog index / search results.
 * Prefers the explicit excerpt when set, otherwise derives one from the
 * first paragraph of the content body.
 */
export function getPostExcerpt(post: BlogPost, fallbackLength = 220): string {
  if (post.excerpt && post.excerpt.trim().length > 0) return post.excerpt
  const firstParagraph = post.content.split('\n\n')[0] ?? ''
  if (firstParagraph.length <= fallbackLength) return firstParagraph
  return firstParagraph.slice(0, fallbackLength).trimEnd() + '…'
}

export function resolveBlogPosts(): BlogPost[] {
  return BLOG_POST_DEFAULTS;
}