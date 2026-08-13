import { Injectable } from '@nestjs/common';

export type AdministrativeScope = 'ADMINISTRATIVE' | 'OUT_OF_SCOPE';

const MAX_INPUT_CHARS = 300;
const MAX_INPUT_TOKENS = 40;

const ARABIC_ADMIN_WORDS = new Set([
  'مركز', 'المركز', 'مركزكم', 'سواء',
  'خدمه', 'الخدمه', 'خدمات', 'الخدمات',
  'متاح', 'متاحه', 'المتاح', 'المتاحه', 'المتاحون', 'المتاحين', 'توفر', 'التوفر',
  'معالج', 'المعالج', 'معالجون', 'المعالجون', 'معالجين', 'المعالجين',
  'مختص', 'المختص', 'مختصون', 'المختصون', 'مختصين', 'المختصين',
  'اخصائي', 'الاخصائي', 'اخصائيون', 'الاخصائيون', 'اخصائيين', 'الاخصائيين',
  'موعد', 'الموعد', 'مواعيد', 'المواعيد', 'حجز', 'الحجز', 'احجز',
  'شاغر', 'شاغره', 'شاغرون', 'شاغرين',
  'سعر', 'السعر', 'اسعار', 'الاسعار', 'تكلفه', 'التكلفه',
  'موقع', 'الموقع', 'موقعكم', 'عنوان', 'العنوان', 'عنوانكم',
  'ساعه', 'الساعه', 'ساعات', 'الساعات', 'عمل', 'العمل', 'دوام', 'الدوام',
  'استقبال', 'الاستقبال', 'تحويل', 'التحويل', 'حولني',
  'تواصل', 'التواصل', 'اتواصل', 'هاتف', 'الهاتف', 'جوال', 'الجوال',
  'رقم', 'الرقم', 'بريد', 'البريد', 'الكتروني',
  'فرع', 'الفرع', 'فروع', 'الفروع', 'جلسه', 'الجلسه', 'جلسات', 'الجلسات',
  'ارشاد', 'الارشاد', 'اسري', 'الاسري', 'استشاره', 'الاستشاره',
  'اليوم', 'غدا', 'اسبوع', 'الاسبوع', 'قادم', 'القادم', 'صباحا', 'مساء', 'حضوري', 'اونلاين',
]);

const ARABIC_GREETING_WORDS = new Set([
  'مرحبا', 'اهلا', 'اهلين', 'السلام', 'عليكم', 'وعليكم', 'صباح', 'الخير', 'مساء',
]);

const ARABIC_STOP_WORDS = new Set([
  'ما', 'ماذا', 'هل', 'من', 'هم', 'هو', 'هي', 'اين', 'متى', 'كيف', 'كم', 'التي', 'الذي',
  'يمكن', 'يمكنني', 'ممكن', 'اريد', 'اود', 'معرفه', 'اعرف', 'اخبرني',
  'يوجد', 'توجد', 'يقع', 'تعملون', 'تقدمون', 'يقدم', 'يقدمها', 'وما', 'وكيف', 'او', 'و',
  'في', 'عن', 'على', 'الى', 'الي', 'مع', 'لديكم', 'لكم', 'لي', 'لنا', 'فضلا', 'لو', 'سمحت',
]);

const ENGLISH_ADMIN_WORDS = new Set([
  'sawa', 'center', 'centre', 'service', 'services', 'practitioner', 'practitioners',
  'therapist', 'therapists', 'counsellor', 'counsellors', 'counselor', 'counselors',
  'appointment', 'appointments', 'availability', 'available', 'booking', 'bookings', 'book',
  'price', 'prices', 'cost', 'costs', 'location', 'address', 'hour', 'hours', 'working',
  'business', 'opening', 'open', 'schedule', 'schedules', 'time', 'times',
  'reception', 'handoff', 'transfer', 'contact', 'phone', 'email', 'branch', 'branches',
  'session', 'sessions', 'slot', 'slots', 'week', 'next', 'counseling', 'counselling',
  'guidance', 'family', 'today', 'tomorrow', 'online', 'inperson',
]);

const ENGLISH_GREETING_WORDS = new Set([
  'hi', 'hello', 'hey', 'good', 'morning', 'evening',
]);

const ENGLISH_STOP_WORDS = new Set([
  'what', 'which', 'who', 'where', 'when', 'how', 'much', 'does', 'do', 'can', 'could',
  'would', 'please', 'you', 'me', 'tell', 'show', 'list', 'give', 'find', 'are', 'is',
  'a', 'an', 'the', 'at', 'in', 'on', 'for', 'of', 'to', 'and', 'or', 'with', 'about',
  'i', 'we', 'your', 'want', 'like', 'have', 'has', 'there', 'any', 'offer', 'offers',
  'get', 'know', 'see',
]);

@Injectable()
export class AdministrativeScopeGate {
  classify(message: string): AdministrativeScope {
    return classifyAdministrativeText(message);
  }
}

export function classifyAdministrativeText(message: string): AdministrativeScope {
  const normalized = normalizeAdministrativeText(message);
  if (!normalized || Array.from(normalized).length > MAX_INPUT_CHARS) return 'OUT_OF_SCOPE';

  const tokens = normalized.split(' ');
  if (tokens.length > MAX_INPUT_TOKENS) return 'OUT_OF_SCOPE';

  let hasAdministrativeWord = false;
  let hasGreetingWord = false;
  for (const token of tokens) {
    if (/^\d{1,4}$/.test(token)) continue;
    if (ARABIC_ADMIN_WORDS.has(token) || ENGLISH_ADMIN_WORDS.has(token)) {
      hasAdministrativeWord = true;
      continue;
    }
    if (ARABIC_GREETING_WORDS.has(token) || ENGLISH_GREETING_WORDS.has(token)) {
      hasGreetingWord = true;
      continue;
    }
    if (ARABIC_STOP_WORDS.has(token) || ENGLISH_STOP_WORDS.has(token)) continue;
    return 'OUT_OF_SCOPE';
  }

  return hasAdministrativeWord || hasGreetingWord ? 'ADMINISTRATIVE' : 'OUT_OF_SCOPE';
}

export function normalizeAdministrativeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/in[ -]person/g, 'inperson')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
