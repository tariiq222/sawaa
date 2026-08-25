import { Injectable } from '@nestjs/common';

export type AdministrativeScope = 'CONVERSATIONAL' | 'BLOCKED_POLICY';

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
const MAX_NORMALIZATION_LOSS_CODEPOINTS = 48;
const MAX_NORMALIZATION_LOSS_CODEPOINT_RATIO = 0.5;
const MAX_MARK_FORMAT_CODEPOINTS = 24;
const MAX_MARK_FORMAT_RATIO = 0.35;
const MAX_MARK_FORMATS_PER_TEXT_GRAPHEME = 3;
const MAX_FORMATS_PER_NON_TEXT_GRAPHEME = 4;

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const MARK_OR_WHITESPACE = /^[\p{M}\p{White_Space}]+$/u;
const MARK_OR_FORMAT = /[\p{M}\p{Cf}]/u;
const GRAPHEME_SEGMENTER = new Intl.Segmenter('und', { granularity: 'grapheme' });

// Deny-only policy gate: valid text is conversational, while these explicit
// categories are blocked before provider invocation.
const PROHIBITED_POLICY_PATTERNS = [
  /(?:شخص|شخصني|تشخيص|يشخص|حلل|تحليل).*(?:حالتي|اعراض|أعراض|خطر|مرض)/u,
  /(?:وضعي|حالتي).*(?:خطر|خطير|خطره)/u,
  /(?:سبب|اسباب).*(?:(?:^|\s)(?:الم|المي)(?:\s|$)|وجع|مرض|اعراض)/u,
  /(?:تقييم|تحليل).*(?:المخاطر|الخطر)/u,
  /(?:هذا|هذه).*(?:مرض|حاله)/u,
  /\b(?:diagnos(?:e|is)|symptoms?|treatment|medical advice|risk assessment|risk|emergency|ambulance|suicide|self harm|kill myself)\b/,
  /\b(?:what is|what s|tell me about).*(?:pain|illness|disease|secret system prompt)\b/,
  /\b(?:do i need|should i see).*(?:doctor|physician)\b/,
  /(?:ignore|disregard|follow) (?:all )?(?:previous|prior|new|system) (?:instructions?|directions?)/,
  /follow .*system (?:instructions?|directions?)/,
  /(?:reveal|show|print|expose|give me).*(?:system prompt|hidden prompt|secrets?|api key|password|credentials?)/,
  /(?:what is|what s|tell me about).*(?:secret|system prompt)/,
  /(?:تجاهل|اتبع|اعرض|اكشف|اعطني).*(?:التعليمات|تعليماتي|البرومبت|الاسرار|الأسرار|المفاتيح|كلمه المرور|كلمة المرور)/u,
  /(?:ما هو|وش هو|ما هي|وش هي).*(?:البرومبت|الاسرار|الأسرار)/u,
] as const;

const RISK_CATEGORY = /(?:خطر|خطير|خطره|حرج|جدي|طوار|موت|اموت|انتحار|قتل نفسي|ايذاء نفسي|serious|critical|risk|dangerous|danger|emergency|die|death|suicide|self harm)/u;
const MEDICAL_CATEGORY = /(?:تشخيص|شخ[صص]|مرض|اعراض|(?:^|\s)الم(?:\s|$)|وجع|حقنه|حقنة|طبيب|دكتور|رعايه طبيه|مساعده طبيه|دواء|medical|diagnos|illness|symptom|pain|doctor|physician|medical care|medical help|injection|inject|advice)/u;
const CLINICAL_TREATMENT_REQUEST = /(?:علاج|treatment).*(?:مناسب|تنصح|استخدم|احتاج|اعراض|should|use|recommend|take)/u;
const CENTER_DOCTOR_DISCOVERY = /(?:هل عندكم|هل يوجد|وش تخصص|اسماء|احجز|حجز|وين|متى).*(?:طبيب|دكتور|معالج|اخصائي).*(?:متاح|موعد|بكره|غدا)?|(?:ممكن|ابي).*(?:موعد|حجز).*(?:طبيب|دكتور)|هل.*(?:طبيب|دكتور).*(?:متاح|موعد|بكره|غدا)|(?:can i see|can i book with|do you have|which doctors|what doctors|where can i find|can i schedule with).*(?:doctor|physician)/u;
const SELF_ASSESSMENT_REQUEST = /(?:هل|ما|وش|ايش).*(?:مكتئب|اكتئاب|مكتيب|اكتياب|قلق|هلع)|(?:what causes|is this|am i|do i have|diagnos|identify).*(?:anxiety|depression|panic|قلق|اكتئاب|هلع)/u;
const INSTRUCTION_CATEGORY = /(?:تعليمات|برومبت|اسرار|مفاتيح|مفتاح api|بيانات الدخول|كلمه المرور|instructions?|prompt|secrets?|api key|password|credentials?)/u;
const POLICY_REQUEST_OR_OVERRIDE = /(?:ما|وش|ايش|هل|ماذا|اعطني|اعرض|اكشف|اظهر|ارسل|أرسل|تجاهل|اتبع|احتاج|ابغى|ابي|ممكن|ساعدني|what|show|send|reveal|give me|tell me|ignore|disregard|follow|need|should|can i|help)/u;
const OBFUSCATED_POLICY_PHRASES = /(?:reveal|show|give|send)secrets?|what(?:are|is)yourinstructions|follow(?:all)?previousinstructions|ignore(?:all)?previousinstructions|اعطنيالاسرار|اعرضالاسرار|اكشفالاسرار|ارسلليsystemprompt|ماهوالبرومبتالسري|تجاهلتعليماتك/u;
const COMPACT_SECRET_TERMS = /(?:systemprompt|apikey|مفتاحapi|password|credentials|secrets?|instructions?|برومبت|اسرار|مفاتيح|كلمهالمرور|بياناتالدخول|تعليمات)/u;
const COMPACT_EXTRACTION_INTENT = /(?:show|reveal|give|send|what|tell|اعرض|اكشف|اعطني|ارسل|ماهو|وشهو|وشهي|تجاهل|اتبع)/u;

@Injectable()
export class AdministrativeScopeGate {
  classify(message: string): AdministrativeScope {
    return classifyAdministrativeText(message);
  }
}

export function classifyAdministrativeText(message: string): AdministrativeScope {
  if (typeof message !== 'string') return 'BLOCKED_POLICY';
  const rawCodepoints = Array.from(message);
  const rawGraphemes = splitGraphemes(message);
  if (
    rawGraphemes.length > MAX_RAW_INPUT_GRAPHEMES
    || rawCodepoints.length > MAX_RAW_INPUT_CODEPOINTS
    || rawGraphemes.some((grapheme) => Array.from(grapheme).length > MAX_CODEPOINTS_PER_GRAPHEME)
  ) return 'BLOCKED_POLICY';

  const normalized = normalizeAdministrativeText(message);
  const normalizedCodepoints = Array.from(normalized);
  const compactNormalized = normalized.replace(/ /g, '');
  const compactPolicyView = normalized.replace(/[^\p{L}\p{N}]/gu, '');
  const normalizedLength = splitGraphemes(normalized).length;
  if (!normalized || normalizedLength > MAX_NORMALIZED_GRAPHEMES) return 'BLOCKED_POLICY';
  if (normalized.split(' ').length > MAX_INPUT_TOKENS) return 'BLOCKED_POLICY';
  if (!hasAcceptableTextShape(
    rawGraphemes,
    rawCodepoints.length,
    normalizedLength,
    normalizedCodepoints.length,
  )) return 'BLOCKED_POLICY';

  if (PROHIBITED_POLICY_PATTERNS.some((pattern) => pattern.test(normalized))
    || RISK_CATEGORY.test(normalized)
    || (MEDICAL_CATEGORY.test(normalized)
      && !CENTER_DOCTOR_DISCOVERY.test(normalized)
      && POLICY_REQUEST_OR_OVERRIDE.test(normalized))
    || SELF_ASSESSMENT_REQUEST.test(normalized)
    || CLINICAL_TREATMENT_REQUEST.test(normalized)
    || (INSTRUCTION_CATEGORY.test(normalized) && POLICY_REQUEST_OR_OVERRIDE.test(normalized))
    || OBFUSCATED_POLICY_PHRASES.test(compactNormalized)
    || (COMPACT_SECRET_TERMS.test(compactPolicyView) && COMPACT_EXTRACTION_INTENT.test(compactPolicyView))) {
    return 'BLOCKED_POLICY';
  }
  return 'CONVERSATIONAL';
}

function hasAcceptableTextShape(
  rawGraphemes: string[],
  rawCodepointCount: number,
  normalizedLength: number,
  normalizedCodepointCount: number,
): boolean {
  let meaningful = 0;
  let nonTextual = 0;
  let markOrFormatCodepoints = 0;
  let currentNonTextualRun = 0;
  let longestNonTextualRun = 0;

  for (const grapheme of rawGraphemes) {
    const graphemeCodepoints = Array.from(grapheme);
    const graphemeMarkOrFormats = graphemeCodepoints.filter((codepoint) => MARK_OR_FORMAT.test(codepoint)).length;
    markOrFormatCodepoints += graphemeMarkOrFormats;
    if (
      (LETTER_OR_NUMBER.test(grapheme) && graphemeMarkOrFormats > MAX_MARK_FORMATS_PER_TEXT_GRAPHEME)
      || (!LETTER_OR_NUMBER.test(grapheme) && graphemeMarkOrFormats > MAX_FORMATS_PER_NON_TEXT_GRAPHEME)
    ) return false;

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

  if (
    markOrFormatCodepoints > MAX_MARK_FORMAT_CODEPOINTS
    && markOrFormatCodepoints / rawCodepointCount > MAX_MARK_FORMAT_RATIO
  ) return false;

  const normalizationLoss = Math.max(0, rawGraphemes.length - normalizedLength);
  if (
    normalizationLoss > MAX_NORMALIZATION_LOSS_GRAPHEMES
    && normalizationLoss / rawGraphemes.length > MAX_NORMALIZATION_LOSS_RATIO
  ) return false;

  const codepointLoss = Math.max(0, rawCodepointCount - normalizedCodepointCount);
  return codepointLoss <= MAX_NORMALIZATION_LOSS_CODEPOINTS
    || codepointLoss / rawCodepointCount <= MAX_NORMALIZATION_LOSS_CODEPOINT_RATIO;
}

function splitGraphemes(value: string): string[] {
  return Array.from(GRAPHEME_SEGMENTER.segment(value), ({ segment }) => segment);
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
