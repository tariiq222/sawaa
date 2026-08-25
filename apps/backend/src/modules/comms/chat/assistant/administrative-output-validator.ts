import { Injectable } from '@nestjs/common';
import { getAdministrativeFallbackResponse } from './administrative-policy';
import type { RenderedAdministrativeResponse } from './administrative-response-renderer';
import { isPublicChatOperation } from '../operations/chat-operation-public.mapper';
import { parseSawaaAgentDecision, SAWAA_AGENT_DECISION_MAX_REPLY_CHARS, type SawaaAgentDecision } from './sawaa-agent-decision';

export const MAX_ADMINISTRATIVE_OUTPUT_CHARS = 2_000;

@Injectable()
export class AdministrativeOutputValidator {
  validate(value: unknown, language: string): RenderedAdministrativeResponse {
    const decision = parseSawaaAgentDecision(value);
    if (decision) {
      return this.validateDecision(decision, language);
    }
    if (this.isModelRenderedResponse(value)) {
      if (this.isUnsafeCustomerReply(value.body, value.grounded === true)) {
        return { source: 'DETERMINISTIC_RENDERER', ...getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE') };
      }
      return { ...value, source: 'MODEL_DECISION', body: value.body.trim(), metadata: null, acceptedModelDecision: true };
    }
    if (this.isRenderedResponse(value)) return value;
    return {
      source: 'DETERMINISTIC_RENDERER',
      ...getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE'),
    };
  }

  private validateDecision(decision: SawaaAgentDecision, language: string): RenderedAdministrativeResponse {
    const reply = decision.reply.trim();
    if (Array.from(reply).length > SAWAA_AGENT_DECISION_MAX_REPLY_CHARS || this.isUnsafeCustomerReply(reply)) {
      return {
        source: 'DETERMINISTIC_RENDERER',
        ...getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE'),
      };
    }
    return { source: 'DETERMINISTIC_RENDERER', body: reply, metadata: null };
  }

  private isUnsafeCustomerReply(reply: string, allowGroundedCommercial = false): boolean {
    // Prices and discounts are accepted only after the orchestration layer proves their
    // grounding against a fresh tool result. This validator has no tool ledger, so it
    // conservatively rejects them here rather than allowing model-invented commercial claims.
    const currency = '(?:ر\\.?\\s*س|ريال|ریال(?:\\s+سعودي)?|SAR|USD|EUR|دولار|دلار(?:\\s+أمريكي)?|تومان|جنيه|ر\\.?س|\\$|€)';
    const amount = '[0-9٠-٩۰-۹]{1,6}(?:[,.٫٬][0-9٠-٩۰-۹]{1,3})?(?:[.٫][0-9٠-٩۰-۹]{1,2})?';
    const arabicNumberWord = '(?:مئتين|مائتين|مئتان|مائتان|مئة|مائة)';
    const commercialContext = '(?:price|cost|fee|fees|料金|السعر|التكلفة|رسوم|قيمة|مبلغ|قیمت|هزینه)';
    const commercialClaim = new RegExp(
      `(?:${currency}\\s*(?:${amount}|${arabicNumberWord})|(?:${amount}|${arabicNumberWord})\\s*${currency}|${commercialContext}[^\\n]{0,60}(?:${amount}|${arabicNumberWord})(?:\\s*${currency})?)`,
      'i',
    );
    return /(?:diagnos|diagnosis|تشخيص|علاج|treatment|therapy|دواء|جرعة|وصفة|خصم|discount|مجاني|free)/i.test(reply)
      || (!allowGroundedCommercial && commercialClaim.test(reply))
      || /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|system)\s+instructions|تجاهل\s+(?:كل\s+)?التعليمات|(?:system\s+)?prompt|رسالة النظام|(?:api[_ -]?key|password|passcode|token|bearer|credentials?|secret)\s*(?:[:=]|\s+\S+)|(?:كلمة\s*المرور|رمز\s*المرور|بيانات\s*الدخول|مفتاح\s*(?:خاص|api)|توكن|السر)\s*(?:[:=]|\s+\S+)/i.test(reply);
  }

  private isRenderedResponse(value: unknown): value is RenderedAdministrativeResponse {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.source === 'DETERMINISTIC_RENDERER'
      && typeof candidate.body === 'string'
      && candidate.body.trim().length > 0
      && Array.from(candidate.body).length <= MAX_ADMINISTRATIVE_OUTPUT_CHARS
      && this.isPublicMetadata(candidate.metadata);
  }

  private isModelRenderedResponse(value: unknown): value is RenderedAdministrativeResponse & { source: 'MODEL_DECISION' } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return candidate.source === 'MODEL_DECISION'
      && typeof candidate.body === 'string'
      && candidate.body.trim().length > 0
      && Array.from(candidate.body).length <= MAX_ADMINISTRATIVE_OUTPUT_CHARS
      && candidate.metadata === null
      && candidate.grounded === true;
  }

  private isPublicMetadata(value: unknown): boolean {
    if (value === null) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const metadata = value as Record<string, unknown>;
    const keys = Object.keys(metadata);
    if (metadata.action === 'OFFER_HANDOFF') {
      return keys.length === 2 && (
          metadata.reason === 'OUT_OF_SCOPE'
          || metadata.reason === 'USER_REQUESTED'
          || metadata.reason === 'LIMIT_REACHED'
        );
    }
    if (metadata.action !== 'CHAT_OPERATION' || keys.length !== 2) return false;
    return isPublicChatOperation(metadata.operation);
  }
}
