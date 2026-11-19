// Website dictionary — feature group: contact.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'contact.title': 'تواصل معنا',
  'contact.description': 'لأي استفسار، املأ النموذج أدناه وسنعود إليك قريباً.',
  'contact.tag': 'تواصل',
  'contact.info.heading': 'معلومات التواصل',
  'contact.info.subheading': 'نسعد بخدمتك والإجابة على استفساراتك.',
  'contact.info.phoneLabel': 'الجوال',
  'contact.info.emailLabel': 'البريد الإلكتروني',
  'contact.info.addressLabel': 'العنوان',
  'contact.info.hoursLabel': 'ساعات العمل',
  'contact.info.hoursValue': 'الأحد - الخميس، 9 صباحاً - 9 مساءً',
  'contact.form.heading': 'أرسل رسالة',
  'contact.form.optional': 'اختياري',
  'contact.form.name': 'الاسم',
  'contact.form.phone': 'الجوال',
  'contact.form.email': 'البريد الإلكتروني',
  'contact.form.subject': 'الموضوع',
  'contact.form.body': 'الرسالة',
  'contact.form.send': 'إرسال',
  'contact.form.sending': 'جاري الإرسال...',
  'contact.form.success': 'تم إرسال رسالتك بنجاح',
  'contact.form.successDesc': 'سنتواصل معك قريباً.',
  'contact.form.sendAnother': 'إرسال رسالة أخرى',
  'contact.form.errors.name': 'الاسم مطلوب',
  'contact.form.errors.contact': 'البريد أو الجوال مطلوب',
  'contact.form.errors.body': 'الرسالة قصيرة جداً',
  'contact.form.errors.submitFailed': 'تعذّر إرسال رسالتك، حاول مرة أخرى',
} as const;

const en: Record<keyof typeof ar, string> = {
  'contact.title': 'Contact Us',
  'contact.description': 'For any inquiry, fill the form below and we will get back to you.',
  'contact.tag': 'Contact',
  'contact.info.heading': 'Contact info',
  'contact.info.subheading': 'We are happy to help and answer your questions.',
  'contact.info.phoneLabel': 'Phone',
  'contact.info.emailLabel': 'Email',
  'contact.info.addressLabel': 'Address',
  'contact.info.hoursLabel': 'Working hours',
  'contact.info.hoursValue': 'Sun - Thu, 9 AM - 9 PM',
  'contact.form.heading': 'Send a message',
  'contact.form.optional': 'optional',
  'contact.form.name': 'Name',
  'contact.form.phone': 'Phone',
  'contact.form.email': 'Email',
  'contact.form.subject': 'Subject',
  'contact.form.body': 'Message',
  'contact.form.send': 'Send',
  'contact.form.sending': 'Sending...',
  'contact.form.success': 'Your message has been sent',
  'contact.form.successDesc': 'We will contact you soon.',
  'contact.form.sendAnother': 'Send another message',
  'contact.form.errors.name': 'Name is required',
  'contact.form.errors.contact': 'Email or phone required',
  'contact.form.errors.body': 'Message too short',
  'contact.form.errors.submitFailed': "Couldn't send your message. Please try again.",
};

export const contactDictionary: LocalizedDictionary<typeof ar> = { ar, en };
