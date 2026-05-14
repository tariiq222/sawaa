import type { Locale } from '../locale/locale';

export interface BurnoutQuestion {
  id: string;
  textAr: string;
  textEn: string;
}

export const QUESTIONS: BurnoutQuestion[] = [
  { id: 'q1', textAr: 'أشعر بالإرهاق في نهاية يوم العمل.', textEn: 'I feel exhausted at the end of my workday.' },
  { id: 'q2', textAr: 'أجد صعوبة في التركيز على مهامي اليومية.', textEn: 'I struggle to concentrate on daily tasks.' },
  { id: 'q3', textAr: 'أعاني من قلة النوم أو اضطرابه.', textEn: 'I experience disturbed or insufficient sleep.' },
  { id: 'q4', textAr: 'أشعر أن حماسي للعمل قد انخفض.', textEn: 'My motivation for work has dropped.' },
  { id: 'q5', textAr: 'أنفعل بسرعة على أمور بسيطة.', textEn: 'I get upset quickly over small things.' },
  { id: 'q6', textAr: 'أشعر بأن الضغط النفسي يفوق قدرتي.', textEn: 'I feel overwhelmed by stress.' },
];

export const OPTIONS = [
  { value: 0, labelAr: 'أبداً', labelEn: 'Never' },
  { value: 1, labelAr: 'نادراً', labelEn: 'Rarely' },
  { value: 2, labelAr: 'أحياناً', labelEn: 'Sometimes' },
  { value: 3, labelAr: 'غالباً', labelEn: 'Often' },
  { value: 4, labelAr: 'دائماً', labelEn: 'Always' },
];

export function scoreLevel(total: number): 'low' | 'medium' | 'high' {
  const max = QUESTIONS.length * 4;
  const pct = total / max;
  if (pct < 0.33) return 'low';
  if (pct < 0.66) return 'medium';
  return 'high';
}

export function optionLabel(locale: Locale, value: number): string {
  const opt = OPTIONS.find((o) => o.value === value);
  if (!opt) return '';
  return locale === 'ar' ? opt.labelAr : opt.labelEn;
}
