import { Injectable } from '@nestjs/common';

export type AdministrativeScope = 'ADMINISTRATIVE' | 'OUT_OF_SCOPE';

const PROHIBITED_PATTERNS = [
  /\b(?:diagnos(?:e|is|tic)|symptoms?|treat(?:ment)?|medicat(?:e|ion)|clinical|medical|triage|risk|emergenc(?:y|ies)|suicid(?:e|al)|self[ -]?harm)\b/i,
  /\b(?:assess|evaluate)\b.{0,24}\b(?:condition|risk|mental|health)\b/i,
  /(?:^|\s)(?:تشخيص|يشخص|تشخص|شخص\s+حالتي|اعراض|الاعراض|علاج|العلاج|دواء|الدواء|حالتي\s+خطره|خطر|تقييم\s+خطر|طواري|الطواري|انتحار|ايذاء\s+نفسي)(?=\s|$)/u,
  /\b(?:ignore|disregard|override|reveal|show)\b.{0,40}\b(?:instructions?|prompt|system|developer|tools?)\b/i,
  /\b(?:jailbreak|prompt[ -]?injection)\b/i,
  /(?:تجاهل|الغ|عطل).{0,30}(?:التعليمات|السياسه|النظام)|(?:اكشف|اعرض).{0,30}(?:البرومبت|التعليمات)/u,
] as const;

const ADMINISTRATIVE_PATTERNS = [
  /(?:^|\s)(?:المركز|مركز|سواء|خدمات|الخدمات|خدمه|الخدمه|معالج|المعالج|المعالجون|المعالجين|مختص|المختصين|اخصائي|الاخصائيين|موعد|مواعيد|حجز|متاح|متاحه|التوفر|سعر|السعر|الاسعار|موقع|موقعكم|العنوان|ساعات|الدوام|الاستقبال|حولني|تحويل)(?=\s|$)/u,
  /\b(?:center|centre|services?|practitioners?|therapists?|appointments?|availability|available|prices?|cost|location|address|working hours|business hours|reception|handoff|transfer)\b/i,
] as const;

const GREETING_PATTERNS = [
  /^(?:مرحبا|اهلا|اهلين|السلام\s+عليكم|وعليكم\s+السلام|صباح\s+الخير|مساء\s+الخير)(?:\s+كيف\s+حالكم?)?$/u,
  /^(?:hi|hello|hey|good morning|good evening)(?: how are you)?$/i,
] as const;

@Injectable()
export class AdministrativeScopeGate {
  classify(message: string): AdministrativeScope {
    return classifyAdministrativeText(message);
  }
}

export function classifyAdministrativeText(message: string): AdministrativeScope {
  const normalized = normalizeAdministrativeText(message);
  if (!normalized || hasProhibitedAdministrativeContent(normalized)) return 'OUT_OF_SCOPE';
  if (GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) return 'ADMINISTRATIVE';
  return ADMINISTRATIVE_PATTERNS.some((pattern) => pattern.test(normalized))
    ? 'ADMINISTRATIVE'
    : 'OUT_OF_SCOPE';
}

export function hasProhibitedAdministrativeContent(value: string): boolean {
  const normalized = normalizeAdministrativeText(value);
  return PROHIBITED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function normalizeAdministrativeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
