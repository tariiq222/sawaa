import { Injectable } from '@nestjs/common';

export type AdministrativeScope = 'ADMINISTRATIVE' | 'OUT_OF_SCOPE';

const MAX_RAW_INPUT_CODEPOINTS = 300;
const MAX_NORMALIZED_CODEPOINTS = 300;
const MAX_INPUT_TOKENS = 40;

const GREETING_TEMPLATES = [
  /^(?:مرحبا|اهلا|اهلين|السلام عليكم|وعليكم السلام|صباح الخير|مساء الخير)$/u,
  /^(?:hi|hello|hey|good morning|good evening)$/,
] as const;

const ARABIC_INTENT_TEMPLATES = [
  /^(?:ما|وش|ايش)(?: هي)? (?:الخدمات|خدمات|خدماتكم)(?: المركز| المتاحه)?(?: اللي عندكم)?$/u,
  /^هل يمكنني معرفه اسعار الخدمات المتاحه في المركز$/u,
  /^ما هي الخدمات التي يقدمها المركز$/u,
  /^(?:من|مين)(?: هم)? (?:المعالجون|المعالجين|الاخصائيون|الاخصائيين|المختصون|المختصين)(?: المتاحون| المتاحين)?(?: عندكم)?(?: وما مواعيد العمل)?$/u,
  /^(?:اين|وين) (?:يقع )?(?:موقعكم|المركز|مركز سواء)(?: وما ساعات العمل| وكيف اتواصل مع الاستقبال)?$/u,
  /^(?:وش|ما) رقم (?:جوال|هاتف)(?: المركز|كم)?$/u,
  /^كيف اتواصل مع (?:المركز|الاستقبال)$/u,
  /^متي (?:تفتحون|دوامكم)$/u,
  /^وش ساعات (?:الدوام|العمل)$/u,
  /^(?:ابغي|اريد|اود) (?:ان )?(?:احجز|حجز) موعد$/u,
  /^هل يوجد موعد متاح غدا$/u,
  /^هل لديكم مواعيد شاغره الاسبوع القادم$/u,
  /^وش المواعيد المتاحه$/u,
  /^(?:كم سعر الخدمه|كم الاسعار|بكم الجلسه)$/u,
  /^حولني (?:الي|الى) الاستقبال$/u,
] as const;

const ENGLISH_INTENT_TEMPLATES = [
  /^what services and appointment times are available$/,
  /^(?:what|which) services are available(?: at the center)?$/,
  /^could you tell me which services are available at the center$/,
  /^who are (?:the |your )?(?:practitioners|therapists|counselors|counsellors)(?: at the center)?(?: and when are appointments available)?$/,
  /^where are you located$/,
  /^where is the (?:center|centre)$/,
  /^what is the (?:center|centre) address and working hours$/,
  /^what s your (?:phone|contact) number$/,
  /^what are your (?:opening|working|business) hours$/,
  /^i d like to book an appointment$/,
  /^i would like to book an appointment$/,
  /^do you have available appointments$/,
  /^can i see your available appointment slots for next week$/,
  /^how much does a counseling session cost$/,
  /^how much are the services$/,
  /^(?:transfer|connect) me to reception$/,
] as const;

const GREETING_PREFIXES = [
  /^(?:مرحبا|اهلا|اهلين|السلام عليكم|صباح الخير|مساء الخير) /u,
  /^(?:hi|hello|hey|good morning|good evening) /,
] as const;

@Injectable()
export class AdministrativeScopeGate {
  classify(message: string): AdministrativeScope {
    return classifyAdministrativeText(message);
  }
}

export function classifyAdministrativeText(message: string): AdministrativeScope {
  if (Array.from(message).length > MAX_RAW_INPUT_CODEPOINTS) return 'OUT_OF_SCOPE';

  const normalized = normalizeAdministrativeText(message);
  if (!normalized || Array.from(normalized).length > MAX_NORMALIZED_CODEPOINTS) return 'OUT_OF_SCOPE';
  if (normalized.split(' ').length > MAX_INPUT_TOKENS) return 'OUT_OF_SCOPE';

  if (GREETING_TEMPLATES.some((template) => template.test(normalized))) return 'ADMINISTRATIVE';
  if (matchesAdministrativeIntent(normalized)) return 'ADMINISTRATIVE';

  for (const prefix of GREETING_PREFIXES) {
    if (prefix.test(normalized) && matchesAdministrativeIntent(normalized.replace(prefix, ''))) {
      return 'ADMINISTRATIVE';
    }
  }
  return 'OUT_OF_SCOPE';
}

function matchesAdministrativeIntent(value: string): boolean {
  return [...ARABIC_INTENT_TEMPLATES, ...ENGLISH_INTENT_TEMPLATES]
    .some((template) => template.test(value));
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
    .trim()
    .replace(/\s+/g, ' ');
}
