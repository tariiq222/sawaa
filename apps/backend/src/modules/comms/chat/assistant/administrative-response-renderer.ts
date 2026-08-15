import { Injectable } from '@nestjs/common';
import {
  getAdministrativeFallbackResponse,
  type AdministrativePublicMetadata,
} from './administrative-policy';
import type {
  AdministrativeServiceProjection,
  AdministrativeToolResult,
} from './administrative-tools.service';
import type { SawaaAgentDecision } from './sawaa-agent-decision';

const MAX_RENDERED_CHARS = 2_000;
const MAX_LABEL_CHARS = 80;
const MAX_RAW_LABEL_CHARS = 240;
const MAX_LABEL_TOKENS = 8;
const MAX_SERVICE_NAME_TOKENS = 6;
const EMPTY_RESULT_DEFEATIST_REPLY = /(?:عذر[ًاا]?|لا\s+(?:استطيع|أستطيع|يمكنني)|لم\s+(?:استطع|أستطع)|غير\s+قادر|\b(?:sorry|unable|cannot|can\s*not|can't)\b)/iu;
const FACTUAL_INTENTS = new Set(['DISCOVER_SERVICE', 'COMPARE_OPTIONS', 'PRICE_OBJECTION', 'BOOKING', 'MANAGE_APPOINTMENT']);
const TRUSTED_EMPTY_LIST_TOOLS = new Set(['listServices', 'listPractitioners', 'getAvailability', 'listOwnAppointments']);

const PROHIBITED_LABEL_TOKENS = new Set([
  'تعليمات', 'التعليمات', 'اسرار', 'الاسرار', 'سر', 'السر', 'برومبت', 'البرومبت',
  'مفتاح', 'رمز', 'كلمه', 'المرور',
  'انصحك', 'خذ', 'تناول', 'قرص', 'قرصين', 'حبه', 'حبتين', 'اقتل', 'باقتل',
  'انتحار', 'طوارئ', 'تجاهل', 'اكشف', 'اعرض', 'اتبع', 'اكتب',
  'ignore', 'instructions', 'instruction', 'reveal', 'secret', 'secrets', 'password',
  'token', 'prompt', 'jailbreak', 'api', 'apikey', 'key', 'authorization', 'bearer',
  'recommend', 'take', 'pill', 'pills', 'kill',
  'suicide', 'emergency', 'book', 'write', 'disclose', 'execute',
]);

const COMMAND_LABEL_STARTS = new Set([
  'اتبع', 'تجاهل', 'اكشف', 'اعرض', 'خذ', 'تناول', 'اكتب', 'احجز', 'ارسل',
  'نفذ', 'قم', 'حولني',
  'follow', 'ignore', 'reveal', 'take', 'book', 'write', 'show', 'send',
  'disclose', 'execute', 'call', 'contact', 'consult', 'program', 'support',
]);

const URL_PATTERN = /(?:https?|ftp|javascript|data):[^\s<]+|www\.[^\s<]+|\b(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62})\.)+[\p{L}]{2,63}(?:\/[^\s<]*)?/giu;
const MARKUP_PATTERN = /<[^>]*>/gu;
const DANGEROUS_MARKUP_PATTERN = /<\s*\/?\s*(?:script|style|iframe|object|embed|svg|math)\b/iu;
const CONTROL_OR_NEWLINE_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu;
const BASIC_LABEL_PATTERN = /^[\p{L}\p{M}\p{N} .,'’&()/:+،؛-]+$/u;
const BASIC_SERVICE_NAME_PATTERN = /^[-\p{L}\p{M} &'’]+$/u;
const COLON_PATTERN = /[:：﹕꞉]/u;
const ARABIC_TOKEN_PATTERN = /^\p{Script=Arabic}+$/u;
const LATIN_TOKEN_PATTERN = /^\p{Script=Latin}+$/u;

const ARABIC_SERVICE_HEADS = new Set([
  'جلسه', 'الجلسه',
  'استشاره', 'الاستشاره',
  'ارشاد', 'الارشاد',
  'متابعه', 'المتابعه',
  'برنامج', 'البرنامج',
  'باقه', 'الباقه',
  'تقييم', 'التقييم',
]);

const ARABIC_SERVICE_MODIFIERS = new Set([
  ...ARABIC_SERVICE_HEADS,
  'اسري', 'اسريه', 'الاسري', 'الاسريه',
  'زوجي', 'زوجيه', 'الزوجي', 'الزوجيه',
  'نفسي', 'نفسيه', 'النفسي', 'النفسيه',
  'طفل', 'الطفل', 'اطفال', 'الاطفال', 'مراهقين', 'المراهقين',
  'دعم', 'الدعم', 'تعافي', 'التعافي', 'ادمان', 'الادمان',
  'اولي', 'اوليه', 'الاولي', 'الاوليه',
  'علاج', 'العلاج', 'معرفي', 'معرفيه', 'سلوكي', 'سلوكيه',
  'سريع', 'سريعه', 'السريع', 'السريعه',
  'فردي', 'فرديه', 'جماعي', 'جماعيه',
  'زواجي', 'زواجيه', 'اسبوعي', 'اسبوعيه',
]);

const ENGLISH_SERVICE_HEADS = new Set([
  'session', 'consultation', 'consult', 'counseling', 'counselling',
  'program', 'programme', 'package', 'assessment',
]);

const ENGLISH_SERVICE_MODIFIERS = new Set([
  ...ENGLISH_SERVICE_HEADS,
  'family', 'families', 'marriage', 'marital', 'couple', 'couples',
  'psychological', 'child', 'children', 'adolescent', 'adolescents',
  'addiction', 'recovery', 'mental', 'health', 'initial',
  'cognitive', 'behavioral', 'behavioural', 'cbt', 'quick',
  'follow', 'up', 'support', 'individual', 'group', 'weekly',
]);

const ENGLISH_SERVICE_NAME_GRAMMAR = [
  /^(?:family|child|children|adolescent|adolescents|cbt|individual|group|weekly) session$/,
  /^(?:marriage|marital|couple|couples|psychological|child|children|adolescent|adolescents) (?:counseling|counselling) session$/,
  /^(?:addiction recovery|mental health|cognitive behavioral|cognitive behavioural) session$/,
  /^initial psychological assessment$/,
  /^follow up session$/,
  /^quick consult$/,
  /^(?:addiction recovery|mental health|family|individual|group) (?:program|programme|package)$/,
] as const;

export interface ExecutedAdministrativeTool {
  name: string;
  result: AdministrativeToolResult;
}

export interface RenderedAdministrativeResponse {
  source: 'DETERMINISTIC_RENDERER' | 'MODEL_DECISION';
  body: string;
  metadata: AdministrativePublicMetadata | null;
  grounded?: boolean;
  acceptedModelDecision?: boolean;
}

export interface GroundedAdministrativeDecision {
  decision: SawaaAgentDecision;
  grounded: boolean;
}

@Injectable()
export class AdministrativeResponseRenderer {
  render(
    executions: ExecutedAdministrativeTool[],
    language: string,
    decision?: SawaaAgentDecision,
  ): RenderedAdministrativeResponse {
    if (decision) return this.renderDecision(decision, executions, language);
    const english = language.toLowerCase().startsWith('en');
    const sections: string[] = [];
    let metadata: AdministrativePublicMetadata | null = null;

    for (const execution of executions) {
      if (!execution.result.ok) continue;
      const section = this.renderTool(execution.name, execution.result.data, english);
      if (section && this.join(sections, section).length <= MAX_RENDERED_CHARS) sections.push(section);
      if (execution.result.publicMetadata) metadata = execution.result.publicMetadata;
    }

    if (sections.length === 0) {
      const fallback = getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE');
      return { source: 'DETERMINISTIC_RENDERER', ...fallback };
    }

    return {
      source: 'DETERMINISTIC_RENDERER',
      body: sections.join('\n\n'),
      metadata,
    };
  }

  private renderDecision(
    decision: SawaaAgentDecision,
    executions: ExecutedAdministrativeTool[],
    language: string,
  ): RenderedAdministrativeResponse {
    // Application-owned operation cards are already backed by a validated,
    // durable operation. A malformed or poorly cited model epilogue must not
    // hide that trusted action from the customer.
    const deterministic = this.render(executions, language);
    if (deterministic.metadata && executions.some((execution) =>
      execution.name === 'prepareReceptionHandoff'
      || execution.name === 'handoffToReception'
      || execution.name === 'prepareBooking'
      || execution.name === 'prepareReschedule'
      || execution.name === 'prepareCancellation'
      || execution.name === 'listOwnAppointments'
    )) return deterministic;

    const grounded = this.isGrounded(decision, executions);
    if (!grounded) {
      // A small model may omit the explicit `recordIds: []` citation after a
      // trusted list tool returns no rows. Never expose its ungrounded prose,
      // but keep the valid customer-service conversation in scope with a
      // claim-free deterministic question.
      if (FACTUAL_INTENTS.has(decision.intent) && this.hasTrustedEmptyList(executions)) {
        return this.emptyListConversationFallback(language, decision.intent);
      }
      return this.fallback(language);
    }

    // Deterministic operation cards and handoff options remain authoritative;
    // the model's final text cannot replace an application-owned action.
    const emptyTrustedResult = decision.factsUsed?.some((fact) => fact.recordIds.length === 0
      && executions.some((execution) => execution.name === fact.tool
        && execution.result.ok
        && Array.isArray(execution.result.data)
        && execution.result.data.length === 0)) === true;
    const body = emptyTrustedResult && EMPTY_RESULT_DEFEATIST_REPLY.test(decision.reply)
      ? (language.toLowerCase().startsWith('en')
          ? 'Absolutely—let me understand what you need so I can guide you well. What kind of support are you looking for?'
          : 'أكيد، خلّني أفهم احتياجك أكثر عشان أوجّهك صح. وش نوع الدعم اللي تبحث عنه؟')
      : decision.reply;
    return {
      source: 'MODEL_DECISION',
      body,
      metadata: null,
      grounded: true,
    };
  }

  private isGrounded(decision: SawaaAgentDecision, executions: ExecutedAdministrativeTool[]): boolean {
    if (!decision.factsUsed?.length) return !FACTUAL_INTENTS.has(decision.intent);
    const finalIndex = executions.findIndex((item) => item.name === 'replyToCustomer');
    const readonlyTools = new Set([
      'getCenterInfo', 'listServices', 'getServiceDetails', 'compareServices', 'listPractitioners',
      'getPractitionerDetails', 'getAvailability', 'searchPublishedKnowledge', 'listOwnAppointments',
    ]);
    return decision.factsUsed.every((fact) => {
      if (!readonlyTools.has(fact.tool) || fact.tool === 'replyToCustomer') return false;
      const executionIndex = executions.findIndex((item) => item.name === fact.tool && item.result.ok);
      const execution = executionIndex >= 0 ? executions[executionIndex] : undefined;
      if (finalIndex >= 0 && executionIndex >= finalIndex) return false;
      if (!execution || !execution.result.ok) return false;
      if (fact.recordIds.length === 0) {
        return Array.isArray(execution.result.data) && execution.result.data.length === 0;
      }
      const ids = this.collectRecordIds(execution.result.data);
      return fact.recordIds.every((id) => ids.has(id));
    });
  }

  private collectRecordIds(value: unknown, output = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
      for (const item of value) this.collectRecordIds(item, output);
      return output;
    }
    if (!value || typeof value !== 'object') return output;
    for (const [key, nested] of Object.entries(value)) {
      if ((key === 'id' || key.endsWith('Id') || key.endsWith('Ids')) && typeof nested === 'string') output.add(nested);
      else if (key.endsWith('Ids') && Array.isArray(nested)) {
        for (const id of nested) if (typeof id === 'string') output.add(id);
      } else this.collectRecordIds(nested, output);
    }
    return output;
  }

  private fallback(language: string): RenderedAdministrativeResponse {
    return { source: 'DETERMINISTIC_RENDERER', ...getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE') };
  }

  private hasTrustedEmptyList(executions: ExecutedAdministrativeTool[]): boolean {
    return executions.some((execution) => TRUSTED_EMPTY_LIST_TOOLS.has(execution.name)
      && execution.result.ok
      && Array.isArray(execution.result.data)
      && execution.result.data.length === 0);
  }

  private emptyListConversationFallback(
    language: string,
    intent: SawaaAgentDecision['intent'],
  ): RenderedAdministrativeResponse {
    const english = language.toLowerCase().startsWith('en');
    const body = intent === 'PRICE_OBJECTION'
      ? (english
          ? 'Absolutely, price matters. What approximate budget works for you so I can guide you toward the closest option?'
          : 'أكيد، السعر مهم. وش الميزانية التقريبية المناسبة لك عشان نوجّهك للخيار الأقرب؟')
      : intent === 'MANAGE_APPOINTMENT'
        ? (english
            ? 'I can help with your appointment. Would you like to view it, reschedule it, or request cancellation?'
            : 'أقدر أساعدك في موعدك. تبي تعرض مواعيدك أو تعيد الجدولة أو تطلب الإلغاء؟')
        : (english
            ? 'Absolutely—let me understand what you need so I can guide you well. What kind of support are you looking for?'
            : 'أكيد، خلّني أفهم احتياجك أكثر عشان أوجّهك صح. وش نوع الدعم اللي تبحث عنه؟');
    return { source: 'DETERMINISTIC_RENDERER', body, metadata: null };
  }

  private renderTool(name: string, data: unknown, english: boolean): string | null {
    switch (name) {
      case 'getCenterInfo':
        return this.renderCenter(data, english);
      case 'listServices':
        return this.renderServices(data, english);
      case 'getServiceDetails':
      case 'compareServices':
        return this.renderServices(data, english);
      case 'listPractitioners':
        return this.renderPractitioners(data, english);
      case 'getPractitionerDetails':
        return this.renderPractitioners(data, english);
      case 'getAvailability':
        return this.renderAvailability(data, english);
      case 'searchPublishedKnowledge':
      case 'searchKnowledge':
        // Knowledge-base fields are intentionally non-renderable in Task 4.
        // They are untrusted free text regardless of apparent scope.
        return null;
      case 'prepareReceptionHandoff':
      case 'handoffToReception':
        return english
          ? 'I can offer the option to contact reception.'
          : 'يمكنني عرض خيار التحويل إلى الاستقبال.';
      case 'listOwnAppointments':
        return this.renderOwnAppointments(data, english);
      case 'prepareBooking':
      case 'prepareReschedule':
      case 'prepareCancellation':
        return this.renderOperationCard(data, english);
      default:
        return null;
    }
  }

  private renderCenter(data: unknown, english: boolean): string | null {
    const item = this.record(data);
    const name = this.safeLabel(english ? item.organizationNameEn : item.organizationNameAr)
      ?? this.safeLabel(english ? item.organizationNameAr : item.organizationNameEn);
    const phone = this.safePhone(item.contactPhone);
    const email = this.safeEmail(item.contactEmail);
    const lines = [name, phone, email].filter((value): value is string => Boolean(value));
    if (lines.length === 0) return null;
    return `${english ? 'Center information:' : 'معلومات المركز:'}\n${lines.map((line) => `- ${line}`).join('\n')}`;
  }

  private renderServices(data: unknown, english: boolean): string | null {
    const lines = this.array(data).flatMap((value) => {
      const item = this.record(value) as AdministrativeServiceProjection;
      const candidates = english
        ? [item.nameEn, item.nameAr]
        : [item.nameAr, item.nameEn];
      const name = candidates.map((candidate) => this.safeServiceName(candidate))
        .find((candidate): candidate is string => candidate !== null) ?? null;
      if (!name) return [];
      const price = item.showPrice === true && typeof item.price === 'number' && Number.isFinite(item.price)
        ? ` — ${item.price} ${this.safeCurrency(item.currency) ?? 'SAR'}`
        : '';
      return [`- ${name}${price}`];
    });
    return lines.length > 0
      ? `${english ? 'Available services:' : 'الخدمات المتاحة:'}\n${lines.join('\n')}`
      : null;
  }

  private renderPractitioners(data: unknown, english: boolean): string | null {
    const count = this.array(data).length;
    return count > 0
      ? `${english ? 'Available practitioner count' : 'عدد المعالجين المتاحين'}: ${count}`
      : null;
  }

  private renderAvailability(data: unknown, english: boolean): string | null {
    const lines = this.array(data).flatMap((value) => {
      const item = this.record(value);
      const start = this.safeIsoDate(item.startTime);
      const end = this.safeIsoDate(item.endTime);
      return start && end ? [`- ${start} — ${end}`] : [];
    });
    return lines.length > 0
      ? `${english ? 'Available times:' : 'الأوقات المتاحة:'}\n${lines.join('\n')}`
      : null;
  }

  private renderOwnAppointments(data: unknown, english: boolean): string | null {
    const operationCard = this.renderOperationCard(data, english);
    if (operationCard) return operationCard;
    const lines = this.array(data).flatMap((value) => {
      const item = this.record(value);
      const bookingId = typeof item.bookingId === 'string'
        && /^[A-Za-z0-9-]{1,100}$/.test(item.bookingId)
        ? item.bookingId
        : null;
      const start = this.safeIsoDate(item.scheduledAt);
      const preferredService = english
        ? [item.serviceName, item.serviceNameAr]
        : [item.serviceNameAr, item.serviceName];
      const service = preferredService
        .map((name) => this.safeServiceName(name))
        .find((name): name is string => name !== null);
      const status = typeof item.status === 'string' && /^[A-Z_]{3,40}$/.test(item.status)
        ? item.status
        : null;
      return bookingId && start && service && status
        ? [`- ${bookingId} — ${start} — ${service} — ${status}`]
        : [];
    });
    return lines.length > 0
      ? `${english ? 'Your appointments:' : 'مواعيدك:'}\n${lines.join('\n')}`
      : null;
  }

  private renderOperationCard(data: unknown, english: boolean): string | null {
    const operation = this.record(this.record(data).operation);
    const status = operation.status;
    const type = operation.type;
    if (
      typeof status !== 'string'
      || typeof type !== 'string'
      || ![
        'AWAITING_AUTH',
        'AWAITING_EXISTING_BOOKING_ACK',
        'AWAITING_CONFIRMATION',
      ].includes(status)
      || ![
        'LIST_OWN_APPOINTMENTS',
        'CREATE_BOOKING',
        'RESCHEDULE_BOOKING',
        'CANCEL_BOOKING',
      ].includes(type)
    ) return null;
    if (status === 'AWAITING_AUTH') {
      return english
        ? 'Please sign in to continue with your appointment request.'
        : 'سجّل الدخول للمتابعة في طلب الموعد.';
    }
    if (status === 'AWAITING_EXISTING_BOOKING_ACK') {
      return english
        ? 'You already have an upcoming appointment. Review both appointments, then acknowledge the additional booking.'
        : 'لديك موعد قادم بالفعل. راجع الموعدين ثم أقرّ بإضافة موعد آخر.';
    }
    if (type === 'RESCHEDULE_BOOKING') {
      return english
        ? 'Review the reschedule details, then use the confirm or decline button.'
        : 'راجع تفاصيل إعادة الجدولة، ثم استخدم زر التأكيد أو الرفض.';
    }
    if (type === 'CANCEL_BOOKING') {
      return english
        ? 'Review the cancellation details, then use the confirm or decline button.'
        : 'راجع تفاصيل الإلغاء، ثم استخدم زر التأكيد أو الرفض.';
    }
    return english
      ? 'Review the booking details, then use the confirm or decline button.'
      : 'راجع تفاصيل الحجز، ثم استخدم زر التأكيد أو الرفض.';
  }

  private safeLabel(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    if (Array.from(value).length > MAX_RAW_LABEL_CHARS) return null;
    if (DANGEROUS_MARKUP_PATTERN.test(value)) return null;

    const label = value
      .normalize('NFKC')
      .replace(MARKUP_PATTERN, ' ')
      .replace(URL_PATTERN, ' ')
      .replace(CONTROL_OR_NEWLINE_PATTERN, ' ')
      .trim()
      .replace(/\s+/gu, ' ');
    const tokens = this.normalizeLabelForSafety(label)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    if (
      label.length === 0
      || Array.from(label).length > MAX_LABEL_CHARS
      || tokens.length > MAX_LABEL_TOKENS
      || !BASIC_LABEL_PATTERN.test(label)
      || tokens.some((token) => PROHIBITED_LABEL_TOKENS.has(token))
      || this.isCommandLikeLabel(tokens)
    ) return null;
    return label;
  }

  private safeServiceName(value: unknown): string | null {
    if (typeof value !== 'string' || Array.from(value).length > MAX_RAW_LABEL_CHARS) return null;

    const normalizedInput = value.normalize('NFKC');
    if (DANGEROUS_MARKUP_PATTERN.test(normalizedInput)) return null;

    const label = normalizedInput
      .replace(MARKUP_PATTERN, ' ')
      .replace(URL_PATTERN, ' ')
      .replace(CONTROL_OR_NEWLINE_PATTERN, ' ')
      .trim()
      .replace(/\s+/gu, ' ');
    if (
      label.length === 0
      || Array.from(label).length > MAX_LABEL_CHARS
      || COLON_PATTERN.test(label)
      || !BASIC_SERVICE_NAME_PATTERN.test(label)
    ) return null;

    const tokens = this.normalizeLabelForSafety(label)
      .split(/[^\p{L}]+/u)
      .filter(Boolean);
    if (tokens.length === 0 || tokens.length > MAX_SERVICE_NAME_TOKENS) return null;
    if (this.isCommandLikeLabel(tokens)) return null;

    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    if (tokens.every((token) => ARABIC_TOKEN_PATTERN.test(token))) {
      return first
        && ARABIC_SERVICE_HEADS.has(first)
        && tokens.every((token) => ARABIC_SERVICE_MODIFIERS.has(token))
        ? label
        : null;
    }
    if (tokens.every((token) => LATIN_TOKEN_PATTERN.test(token))) {
      const phrase = tokens.join(' ');
      return Boolean(last && ENGLISH_SERVICE_HEADS.has(last))
        && tokens.every((token) => ENGLISH_SERVICE_MODIFIERS.has(token))
        && ENGLISH_SERVICE_NAME_GRAMMAR.some((grammar) => grammar.test(phrase))
        ? label
        : null;
    }
    return null;
  }

  private isCommandLikeLabel(tokens: string[]): boolean {
    const first = tokens[0];
    if (!first || !COMMAND_LABEL_STARTS.has(first)) return false;
    return first !== 'follow'
      || tokens.length !== 3
      || tokens[1] !== 'up'
      || tokens[2] !== 'session';
  }

  private normalizeLabelForSafety(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[\u0622\u0623\u0625]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .toLowerCase();
  }

  private safePhone(value: unknown): string | null {
    return typeof value === 'string' && /^\+?[\d ()-]{5,30}$/.test(value.trim()) ? value.trim() : null;
  }

  private safeEmail(value: unknown): string | null {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160
      ? value
      : null;
  }

  private safeCurrency(value: unknown): string | null {
    return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : null;
  }

  private safeIsoDate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }

  private record(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value.slice(0, 10) : [];
  }

  private join(sections: string[], section: string): string {
    return [...sections, section].join('\n\n');
  }
}
