export const SAWAA_AGENT_INTENTS = [
  'SMALL_TALK',
  'DISCOVER_SERVICE',
  'COMPARE_OPTIONS',
  'PRICE_OBJECTION',
  'BOOKING',
  'MANAGE_APPOINTMENT',
  'HANDOFF',
  'OUTSIDE_CENTER',
] as const;

export type SawaaAgentIntent = (typeof SAWAA_AGENT_INTENTS)[number];
export type SawaaJourneyStage = 'EXPLORING' | 'COMPARING' | 'READY_TO_BOOK' | 'HANDOFF';

export type SawaaAgentDecision = {
  reply: string;
  intent: SawaaAgentIntent;
  journeyStage: SawaaJourneyStage;
  factsUsed?: Array<{ tool: string; recordIds: string[] }>;
  contextPatch?: {
    journeyStage?: SawaaJourneyStage;
    serviceInterestIds?: string[];
    practitionerPreferenceIds?: string[];
    modality?: 'IN_PERSON' | 'ONLINE';
    preferredDays?: string[];
    preferredTimeWindow?: string;
    budgetConcern?: boolean;
    selectedServiceId?: string;
    selectedPractitionerId?: string;
  };
  handoffDraft?: {
    category: 'USER_REQUESTED' | 'COMPLAINT' | 'FINANCIAL_EXCEPTION' | 'UNAVAILABLE_APPOINTMENT' | 'OTHER';
    requestSummary: string;
    desiredOutcome: string;
    serviceId?: string;
    practitionerId?: string;
    acceptableAlternatives?: string[];
  };
};

export const SAWAA_AGENT_DECISION_MAX_REPLY_CHARS = 2_000;

const intents = new Set<string>(SAWAA_AGENT_INTENTS);
const stages = new Set<string>(['EXPLORING', 'COMPARING', 'READY_TO_BOOK', 'HANDOFF']);
const handoffCategories = new Set<string>([
  'USER_REQUESTED', 'COMPLAINT', 'FINANCIAL_EXCEPTION', 'UNAVAILABLE_APPOINTMENT', 'OTHER',
]);
const forbiddenKey = /(?:clinical|diagnos|treatment|therapy|symptom|risk|emergency|prompt|secret|token|password|api.?key|system.?message|chain.?of.?thought|client.?id|internal|raw|url)/i;
const urlOrSecret = /(?:https?:\/\/|www\.|sk-[A-Za-z0-9]|-----BEGIN)/i;
const explicitSecret = /(?:\b(?:password|passcode|token|bearer|private\s+key|api\s+key|credential|credentials|secret|login\s*(?:data|details)?)\b\s*(?:[:=]|is|are|please\s+(?:send|share|provide)|to\s+(?:me|us)|\S+)|(?:كلمة\s*المرور|رمز\s*المرور|التوكن|التوكنات|توكن|مفتاح\s*خاص|مفتاح\s*api|بيانات\s*الدخول|بيانات\s*تسجيل\s*الدخول|بيانات\s*اعتماد|السر)\s*(?:[:=]|هو|هي|ارسل|أرسل|شارك|اعطني|أعطني|\s+\S+))/i;

type RecordValue = Record<string, unknown>;

export function parseSawaaAgentDecision(value: unknown): SawaaAgentDecision | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['reply', 'intent', 'journeyStage', 'factsUsed', 'contextPatch', 'handoffDraft'])) return null;
  const reply = boundedText(ownValue(value, 'reply'), SAWAA_AGENT_DECISION_MAX_REPLY_CHARS);
  const intent = ownValue(value, 'intent');
  const journeyStage = ownValue(value, 'journeyStage');
  if (!reply || typeof intent !== 'string' || !intents.has(intent)
    || typeof journeyStage !== 'string' || !stages.has(journeyStage)) return null;

  const result: SawaaAgentDecision = {
    reply,
    intent: intent as SawaaAgentIntent,
    journeyStage: journeyStage as SawaaJourneyStage,
  };
  const factsUsed = ownValue(value, 'factsUsed');
  if (factsUsed !== undefined) {
    if (!Array.isArray(factsUsed) || factsUsed.length > 10) return null;
    const facts = factsUsed.map(parseFact);
    if (facts.some((fact) => !fact)) return null;
    result.factsUsed = facts as Array<{ tool: string; recordIds: string[] }>;
  }
  const contextPatch = ownValue(value, 'contextPatch');
  if (contextPatch !== undefined) {
    const patch = parseContextPatch(contextPatch);
    if (!patch) return null;
    result.contextPatch = patch;
  }
  const handoffDraft = ownValue(value, 'handoffDraft');
  if (handoffDraft !== undefined) {
    const draft = parseHandoffDraft(handoffDraft);
    if (!draft) return null;
    result.handoffDraft = draft;
  }
  return result;
}

function parseFact(value: unknown): { tool: string; recordIds: string[] } | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['tool', 'recordIds'])) return null;
  const tool = boundedText(ownValue(value, 'tool'), 80);
  const recordIds = boundedStringArray(ownValue(value, 'recordIds'), 20, 100);
  return tool && recordIds ? { tool, recordIds } : null;
}

function parseContextPatch(value: unknown): SawaaAgentDecision['contextPatch'] | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'journeyStage', 'serviceInterestIds', 'practitionerPreferenceIds', 'modality',
    'preferredDays', 'preferredTimeWindow', 'budgetConcern', 'selectedServiceId', 'selectedPractitionerId',
  ])) return null;
  const result: NonNullable<SawaaAgentDecision['contextPatch']> = {};
  const journeyStage = ownValue(value, 'journeyStage');
  if (journeyStage !== undefined) {
    if (typeof journeyStage !== 'string' || !stages.has(journeyStage)) return null;
    result.journeyStage = journeyStage as SawaaJourneyStage;
  }
  for (const key of ['serviceInterestIds', 'practitionerPreferenceIds', 'preferredDays'] as const) {
    const field = ownValue(value, key);
    if (field !== undefined) {
      const items = boundedStringArray(field, 10, 100);
      if (!items) return null;
      result[key] = items;
    }
  }
  const modality = ownValue(value, 'modality');
  if (modality !== undefined) {
    if (modality !== 'IN_PERSON' && modality !== 'ONLINE') return null;
    result.modality = modality;
  }
  const preferredTimeWindow = ownValue(value, 'preferredTimeWindow');
  if (preferredTimeWindow !== undefined) {
    const text = boundedText(preferredTimeWindow, 80);
    if (!text) return null;
    result.preferredTimeWindow = text;
  }
  const budgetConcern = ownValue(value, 'budgetConcern');
  if (budgetConcern !== undefined) {
    if (typeof budgetConcern !== 'boolean') return null;
    result.budgetConcern = budgetConcern;
  }
  for (const key of ['selectedServiceId', 'selectedPractitionerId'] as const) {
    const field = ownValue(value, key);
    if (field !== undefined) {
      const text = boundedText(field, 100);
      if (!text) return null;
      result[key] = text;
    }
  }
  return result;
}

function parseHandoffDraft(value: unknown): SawaaAgentDecision['handoffDraft'] | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'category', 'requestSummary', 'desiredOutcome', 'serviceId', 'practitionerId', 'acceptableAlternatives',
  ])) return null;
  const category = ownValue(value, 'category');
  const requestSummary = boundedText(ownValue(value, 'requestSummary'), 300);
  const desiredOutcome = boundedText(ownValue(value, 'desiredOutcome'), 200);
  if (typeof category !== 'string' || !handoffCategories.has(category) || !requestSummary || !desiredOutcome) return null;
  const result: NonNullable<SawaaAgentDecision['handoffDraft']> = {
    category: category as NonNullable<SawaaAgentDecision['handoffDraft']>['category'], requestSummary, desiredOutcome,
  };
  for (const key of ['serviceId', 'practitionerId'] as const) {
    const field = ownValue(value, key);
    if (field !== undefined) {
      const text = boundedText(field, 100);
      if (!text) return null;
      result[key] = text;
    }
  }
  const acceptableAlternatives = ownValue(value, 'acceptableAlternatives');
  if (acceptableAlternatives !== undefined) {
    const alternatives = boundedStringArray(acceptableAlternatives, 5, 120);
    if (!alternatives) return null;
    result.acceptableAlternatives = alternatives;
  }
  return result;
}

function boundedStringArray(value: unknown, maxItems: number, maxChars: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result = value.map((item) => boundedText(item, maxChars));
  return result.every((item): item is string => !!item) ? result : null;
}

function boundedText(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > maxChars || urlOrSecret.test(value) || explicitSecret.test(value)) return null;
  return value.trim();
}

function isRecord(value: unknown): value is RecordValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: RecordValue, allowed: string[]): boolean {
  const ownKeys = Object.keys(value);
  if (!ownKeys.every((key) => allowed.includes(key) && !forbiddenKey.test(key))) return false;
  return allowed.every((key) => !(key in value) || Object.prototype.hasOwnProperty.call(value, key));
}

function ownValue(value: RecordValue, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}
