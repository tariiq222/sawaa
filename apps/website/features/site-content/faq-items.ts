export interface FaqItem {
  q: string;
  qEn: string;
  a: string;
  aEn: string;
}

export const FAQ_DEFAULTS: FaqItem[] = [
  { q: 'كم تكلفة الجلسة؟', qEn: 'How much does a session cost?', a: 'تختلف تكلفة الجلسة حسب نوع الاستشارة والمعالج. للاطلاع على الأسعار التفصيلية يمكنك التواصل معنا أو زيارة صفحة حجز المواعيد.', aEn: 'Session pricing varies by consultation type and therapist. For detailed pricing, please contact us or visit the booking page.' },
  { q: 'هل تقبلون التأمين الطبي؟', qEn: 'Do you accept medical insurance?', a: 'نعمل حالياً على توسيع شبكة شركاء التأمين. تواصل معنا للاستفسار عن آخر التحديثات بخصوص شركة التأمين الخاصة بك.', aEn: 'We are currently expanding our insurance partner network. Please contact us for the latest update on your insurance provider.' },
  { q: 'هل الجلسات سرية تماماً؟', qEn: 'Are sessions fully confidential?', a: 'نعم — جميع الجلسات والبيانات محمية بسرية مهنية مطلقة وفق معايير الهيئة السعودية للتخصصات الصحية. لا تُشارك أي معلومات مع أي طرف دون إذنك الصريح.', aEn: 'Yes — all sessions and data are protected under strict professional confidentiality per Saudi Commission for Health Specialties standards. No information is shared with any party without your explicit consent.' },
  { q: 'كم تستغرق الجلسة الواحدة؟', qEn: 'How long does a single session take?', a: 'الجلسة الاعتيادية 45 دقيقة، وقد تختلف حسب نوع الاستشارة وتوصية المعالج.', aEn: 'A standard session is 45 minutes and may vary depending on the consultation type and your therapist\'s recommendation.' },
  { q: 'ما الفرق بين الجلسة الحضورية وعن بُعد؟', qEn: 'What is the difference between in-person and remote sessions?', a: 'الحضورية في مقر العيادة بالرياض، وعن بُعد عبر منصة آمنة مشفّرة من أي مكان. كلاهما بنفس الجودة والكفاءة العلاجية.', aEn: 'In-person sessions take place at our clinic in Riyadh; remote sessions run on a secure, encrypted platform from anywhere. Both deliver the same therapeutic quality and effectiveness.' },
  { q: 'كيف تكون الجلسة الأولى؟', qEn: 'What is the first session like?', a: 'تقييم أولي يستمع فيه المعالج لاحتياجاتك ويبني خطة علاجية مناسبة لك. لا التزام بعدد جلسات محدد — أنت تقرر.', aEn: 'An initial assessment where the therapist listens to your needs and builds a treatment plan suited to you. No commitment to a fixed number of sessions — you decide.' },
];

export function resolveFaqItems(): FaqItem[] {
  return FAQ_DEFAULTS;
}
