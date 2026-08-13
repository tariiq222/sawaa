import { Injectable } from '@nestjs/common';
import { getAdministrativeFallbackResponse } from './administrative-policy';
import type { RenderedAdministrativeResponse } from './administrative-response-renderer';

export const MAX_ADMINISTRATIVE_OUTPUT_CHARS = 2_000;

@Injectable()
export class AdministrativeOutputValidator {
  validate(value: unknown, language: string): RenderedAdministrativeResponse {
    if (this.isRenderedResponse(value)) return value;
    return {
      source: 'DETERMINISTIC_RENDERER',
      ...getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE'),
    };
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

  private isPublicMetadata(value: unknown): boolean {
    if (value === null) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const metadata = value as Record<string, unknown>;
    const keys = Object.keys(metadata);
    return keys.length === 2
      && metadata.action === 'OFFER_HANDOFF'
      && (
        metadata.reason === 'OUT_OF_SCOPE'
        || metadata.reason === 'USER_REQUESTED'
        || metadata.reason === 'LIMIT_REACHED'
      );
  }
}
