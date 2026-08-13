import { Injectable } from '@nestjs/common';
import {
  getAdministrativeFallbackResponse,
  type AdministrativePublicMetadata,
} from './administrative-policy';
import { AdministrativeScopeGate } from './administrative-scope-gate';
import type { AdministrativeToolResult } from './administrative-tools.service';

const MAX_RENDERED_CHARS = 2_000;
const MAX_LABEL_CHARS = 80;
const MAX_KNOWLEDGE_SNIPPET_CHARS = 280;

const UNSAFE_DYNAMIC_LABEL_WORDS = new Set([
  'اتبع', 'تجاهل', 'تعليمات', 'التعليمات', 'اكشف', 'اعرض', 'اسرار', 'الاسرار',
  'انصحك', 'تناول', 'قرص', 'قرصين', 'اقتل', 'باقتل', 'انتحار', 'طوارئ',
  'follow', 'ignore', 'instructions', 'instruction', 'reveal', 'secret', 'secrets',
  'recommend', 'take', 'pill', 'pills', 'kill', 'suicide', 'emergency',
]);

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
  constructor(private readonly scopeGate: AdministrativeScopeGate) {}

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
        return this.renderKnowledge(data, english);
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
      const name = this.safeLabel(english ? item.nameEn : item.nameAr)
        ?? this.safeLabel(english ? item.nameAr : item.nameEn);
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

  private renderKnowledge(data: unknown, english: boolean): string | null {
    const lines = this.array(data).flatMap((value) => {
      const content = this.record(value).content;
      if (typeof content !== 'string') return [];
      const snippet = content.trim();
      if (
        snippet.length === 0
        || Array.from(snippet).length > MAX_KNOWLEDGE_SNIPPET_CHARS
        || this.scopeGate.classify(snippet) !== 'ADMINISTRATIVE'
      ) return [];
      return [`- ${snippet}`];
    });
    return lines.length > 0
      ? `${english ? 'Administrative knowledge:' : 'معلومات إدارية من قاعدة المعرفة:'}\n${lines.join('\n')}`
      : null;
  }

  private safeLabel(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const label = value.trim().replace(/\s+/g, ' ');
    const tokens = label.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (
      label.length === 0
      || Array.from(label).length > MAX_LABEL_CHARS
      || tokens.length > 8
      || !/^[\p{L}\p{N} .'-]+$/u.test(label)
      || tokens.some((token) => UNSAFE_DYNAMIC_LABEL_WORDS.has(token))
    ) return null;
    return this.scopeGate.classify(label) === 'ADMINISTRATIVE' ? label : null;
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
