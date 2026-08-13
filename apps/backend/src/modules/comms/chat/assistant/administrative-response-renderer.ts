import { Injectable } from '@nestjs/common';
import {
  getAdministrativeFallbackResponse,
  type AdministrativePublicMetadata,
} from './administrative-policy';
import type { AdministrativeToolResult } from './administrative-tools.service';

const MAX_RENDERED_CHARS = 2_000;
const MAX_LABEL_CHARS = 80;
const MAX_RAW_LABEL_CHARS = 240;
const MAX_LABEL_TOKENS = 8;

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
  'disclose', 'execute', 'call', 'contact',
]);

const URL_PATTERN = /(?:https?|ftp|javascript|data):[^\s<]+|www\.[^\s<]+|\b(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,62})\.)+[\p{L}]{2,63}(?:\/[^\s<]*)?/giu;
const MARKUP_PATTERN = /<[^>]*>/gu;
const DANGEROUS_MARKUP_PATTERN = /<\s*\/?\s*(?:script|style|iframe|object|embed|svg|math)\b/iu;
const CONTROL_OR_NEWLINE_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu;
const BASIC_LABEL_PATTERN = /^[\p{L}\p{M}\p{N} .,'’&()/:+،؛-]+$/u;

export interface ExecutedAdministrativeTool {
  name: string;
  result: AdministrativeToolResult;
}

export interface RenderedAdministrativeResponse {
  source: 'DETERMINISTIC_RENDERER';
  body: string;
  metadata: AdministrativePublicMetadata | null;
}

@Injectable()
export class AdministrativeResponseRenderer {
  render(executions: ExecutedAdministrativeTool[], language: string): RenderedAdministrativeResponse {
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

  private renderTool(name: string, data: unknown, english: boolean): string | null {
    switch (name) {
      case 'getCenterInfo':
        return this.renderCenter(data, english);
      case 'listServices':
        return this.renderServices(data, english);
      case 'listPractitioners':
        return this.renderPractitioners(data, english);
      case 'getAvailability':
        return this.renderAvailability(data, english);
      case 'searchKnowledge':
        // Knowledge-base fields are intentionally non-renderable in Task 4.
        // They are untrusted free text regardless of apparent scope.
        return null;
      case 'handoffToReception':
        return english
          ? 'I can offer the option to contact reception.'
          : 'يمكنني عرض خيار التحويل إلى الاستقبال.';
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
      const item = this.record(value);
      const candidates = english
        ? [item.nameEn, item.nameAr, item.name]
        : [item.nameAr, item.nameEn, item.name];
      const name = candidates.map((candidate) => this.safeLabel(candidate))
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

  private isCommandLikeLabel(tokens: string[]): boolean {
    const first = tokens[0];
    if (!first || !COMMAND_LABEL_STARTS.has(first)) return false;
    return first !== 'follow' || tokens[1] !== 'up';
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
