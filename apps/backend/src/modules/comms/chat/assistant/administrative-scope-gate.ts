import { Injectable } from '@nestjs/common';

export type AdministrativeScope = 'ADMINISTRATIVE' | 'OUT_OF_SCOPE';

const MAX_RAW_INPUT_GRAPHEMES = 300;
const MAX_RAW_INPUT_CODEPOINTS = 2_400;
const MAX_CODEPOINTS_PER_GRAPHEME = 16;
const MAX_NORMALIZED_GRAPHEMES = 300;
const MAX_INPUT_TOKENS = 40;
const MAX_NON_TEXTUAL_RUN = 6;
const MAX_NON_TEXTUAL_BEFORE_DENSITY_CHECK = 8;
const MAX_NON_TEXTUAL_RATIO = 0.25;
const MIN_MEANINGFUL_RATIO = 0.6;
const MAX_NORMALIZATION_LOSS_GRAPHEMES = 24;
const MAX_NORMALIZATION_LOSS_RATIO = 0.35;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const MARK_OR_WHITESPACE = /^[\p{M}\p{White_Space}]+$/u;
const GRAPHEME_SEGMENTER = new Intl.Segmenter('und', { granularity: 'grapheme' });

const GREETING_TEMPLATES = [
  /^(?:مرحبا|اهلا|اهلين|السلام عليكم|وعليكم السلام|صباح الخير|مساء الخير)$/u,
  /^(?:hi|hello|hey|good morning|good evening)$/,
] as const;

// Each group is a closed, whole-message grammar for one administrative intent.
// New dialect variants belong in the narrow intent group that owns them.
const ARABIC_INTENT_TEMPLATES = {
  services: [
    /^(?:ما|وش|ايش)(?: هي)? (?:الخدمات|خدمات|خدماتكم)(?: (?:المركز|المتاحه|المتوفره))?(?: اللي)?(?: عندكم)?$/u,
    /^(?:ما هي الخدمات التي يقدمها المركز|وش تقدمون من خدمات)$/u,
    /^(?:ممكن )?(?:اعرف|معرفه) (?:الخدمات|خدمات) المركز$/u,
  ],
  practitioners: [
    /^(?:من|مين)(?: هم)? (?:المعالجون|المعالجين|الاخصاييون|الاخصاييين|المختصون|المختصين)(?: المتاحون| المتاحين)?(?: عندكم)?(?: وما مواعيد العمل)?$/u,
    /^(?:وش|ما|ايش) اسماء (?:المعالجين|الاخصاييين|المختصين)(?: المتاحين)?(?: عندكم)?$/u,
    /^(?:ابغي|ابغا|ابي|اريد) اسماء (?:المعالجين|الاخصاييين|المختصين)(?: المتاحين)?(?: عندكم)?$/u,
  ],
  location: [
    /^(?:اين|وين) (?:يقع )?(?:موقعكم|المركز|مركز سواء|موقع المركز)(?: وما ساعات العمل| وكيف اتواصل مع الاستقبال)?$/u,
    /^(?:ممكن )?(?:تعطيني|اعطني) (?:عنوان|موقع) المركز$/u,
    /^كيف اوصل (?:الي|الى|ل)لمركز$/u,
  ],
  contact: [
    /^(?:وش|ما|ايش) رقم (?:(?:جوال|هاتف) )?(?:المركز|كم)$/u,
    /^(?:ممكن )?(?:تعطيني|اعطني) رقم (?:جوال|هاتف) المركز$/u,
    /^كيف اتواصل مع (?:المركز|الاستقبال)$/u,
  ],
  hours: [
    /^متي (?:تفتحون|دوامكم)(?: ومتي تقفلون)?$/u,
    /^(?:وش|ما)(?: هي)? (?:ساعات|اوقات) (?:الدوام|دوامكم|العمل|عمل المركز)$/u,
  ],
  booking: [
    /^(?:ابغي|ابغا|ابي|اريد|اود) (?:ان )?(?:(?:احجز|حجز) )?(?:موعد|جلسه)$/u,
    /^ممكن (?:احجز|حجز) (?:موعد|جلسه)$/u,
  ],
  availability: [
    /^هل يوجد موعد متاح غدا$/u,
    /^(?:هل )?(?:عندكم|لديكم) (?:موعد|مواعيد)(?: متاحه| شاغره)? (?:بكره|غدا|الاسبوع (?:القادم|الجاي))$/u,
    /^هل فيه (?:موعد|مواعيد)(?: متاحه)? (?:بكره|غدا)$/u,
    /^هل لديكم مواعيد شاغره الاسبوع القادم$/u,
    /^وش المواعيد المتاحه$/u,
  ],
  pricing: [
    /^هل يمكنني معرفه اسعار الخدمات المتاحه في المركز$/u,
    /^(?:كم سعر (?:الخدمه|الجلسه)|كم الاسعار|بكم الجلسه)$/u,
    /^كم تكلفه جلسه (?:الاستشاره|الارشاد)$/u,
    /^(?:وش|ما) اسعار (?:الجلسات|الخدمات)$/u,
  ],
  handoff: [
    /^حولني (?:الي|الى) الاستقبال$/u,
  ],
} as const;

const ENGLISH_INTENT_TEMPLATES = {
  services: [
    /^what services and appointment times are available$/,
    /^(?:what|which) services are available(?: at the (?:center|centre))?$/,
    /^(?:what|which) services do you (?:offer|provide)$/,
    /^could you tell me which services are available at the (?:center|centre)$/,
  ],
  practitioners: [
    /^who are (?:the |your )?(?:practitioners|therapists|counselors|counsellors)(?: at the (?:center|centre))?(?: and when are appointments available)?$/,
  ],
  location: [
    /^where are you located$/,
    /^where is (?:the |your )?(?:center|centre)(?: located)?$/,
    /^what is your address$/,
    /^what is the (?:center|centre) address and working hours$/,
    /^could you give me (?:the |your )?(?:center|centre) address$/,
  ],
  contact: [
    /^what s your (?:phone|contact) number$/,
    /^can i get (?:the |your )?(?:(?:center|centre) )?(?:phone|contact) number$/,
    /^how can i contact reception$/,
  ],
  hours: [
    /^what are (?:your|the (?:center|centre)) (?:opening|working|business) hours$/,
    /^what time do you open$/,
    /^when does the (?:center|centre) open$/,
  ],
  booking: [
    /^i d like to book an appointment$/,
    /^i would like to book an appointment$/,
    /^can i book an appointment$/,
    /^could i schedule an appointment$/,
  ],
  availability: [
    /^do you have available appointments$/,
    /^do you have an appointment tomorrow$/,
    /^can i see your available appointment slots for next week$/,
  ],
  pricing: [
    /^how much does a counseling session cost$/,
    /^how much are the services$/,
    /^how much is a session$/,
    /^what does a counseling session cost$/,
  ],
  handoff: [
    /^(?:transfer|connect) me to reception$/,
  ],
} as const;

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
  const rawCodepoints = Array.from(message);
  const rawGraphemes = splitGraphemes(message);
  if (
    rawGraphemes.length > MAX_RAW_INPUT_GRAPHEMES
    || rawCodepoints.length > MAX_RAW_INPUT_CODEPOINTS
    || rawGraphemes.some((grapheme) => Array.from(grapheme).length > MAX_CODEPOINTS_PER_GRAPHEME)
  ) return 'OUT_OF_SCOPE';

  const normalized = normalizeAdministrativeText(message);
  const normalizedLength = splitGraphemes(normalized).length;
  if (!normalized || normalizedLength > MAX_NORMALIZED_GRAPHEMES) return 'OUT_OF_SCOPE';
  if (normalized.split(' ').length > MAX_INPUT_TOKENS) return 'OUT_OF_SCOPE';
  if (!hasAcceptableTextShape(rawGraphemes, normalizedLength)) return 'OUT_OF_SCOPE';

  if (GREETING_TEMPLATES.some((template) => template.test(normalized))) return 'ADMINISTRATIVE';
  if (matchesAdministrativeIntent(normalized)) return 'ADMINISTRATIVE';

  for (const prefix of GREETING_PREFIXES) {
    if (prefix.test(normalized) && matchesAdministrativeIntent(normalized.replace(prefix, ''))) {
      return 'ADMINISTRATIVE';
    }
  }
  return 'OUT_OF_SCOPE';
}

function hasAcceptableTextShape(rawGraphemes: string[], normalizedLength: number): boolean {
  let meaningful = 0;
  let nonTextual = 0;
  let currentNonTextualRun = 0;
  let longestNonTextualRun = 0;

  for (const grapheme of rawGraphemes) {
    if (LETTER_OR_NUMBER.test(grapheme)) {
      meaningful += 1;
      currentNonTextualRun = 0;
    } else if (MARK_OR_WHITESPACE.test(grapheme)) {
      currentNonTextualRun = 0;
    } else {
      nonTextual += 1;
      currentNonTextualRun += 1;
      longestNonTextualRun = Math.max(longestNonTextualRun, currentNonTextualRun);
    }
  }

  if (meaningful === 0 || longestNonTextualRun > MAX_NON_TEXTUAL_RUN) return false;

  const visibleContent = meaningful + nonTextual;
  if (meaningful / visibleContent < MIN_MEANINGFUL_RATIO) return false;
  if (
    nonTextual > MAX_NON_TEXTUAL_BEFORE_DENSITY_CHECK
    && nonTextual / rawGraphemes.length > MAX_NON_TEXTUAL_RATIO
  ) return false;

  const normalizationLoss = Math.max(0, rawGraphemes.length - normalizedLength);
  return normalizationLoss <= MAX_NORMALIZATION_LOSS_GRAPHEMES
    || normalizationLoss / rawGraphemes.length <= MAX_NORMALIZATION_LOSS_RATIO;
}

function splitGraphemes(value: string): string[] {
  return Array.from(GRAPHEME_SEGMENTER.segment(value), ({ segment }) => segment);
}

function matchesAdministrativeIntent(value: string): boolean {
  return [
    ...Object.values(ARABIC_INTENT_TEMPLATES),
    ...Object.values(ENGLISH_INTENT_TEMPLATES),
  ].some((templates) => templates.some((template) => template.test(value)));
}

export function normalizeAdministrativeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/in[ -]person/g, 'inperson')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
