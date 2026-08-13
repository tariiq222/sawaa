import { Injectable } from '@nestjs/common';
import {
  getAdministrativeFallbackResponse,
  type AdministrativePublicMetadata,
} from './administrative-policy';
import {
  classifyAdministrativeText,
  hasProhibitedAdministrativeContent,
} from './administrative-scope-gate';

export const MAX_ADMINISTRATIVE_OUTPUT_CHARS = 2_000;

@Injectable()
export class AdministrativeOutputValidator {
  validate(
    body: string,
    language: string,
    metadata: AdministrativePublicMetadata | null,
  ): { body: string; metadata: AdministrativePublicMetadata | null } {
    const normalizedBody = body.trim();
    if (
      normalizedBody.length === 0
      || Array.from(normalizedBody).length > MAX_ADMINISTRATIVE_OUTPUT_CHARS
      || hasProhibitedAdministrativeContent(normalizedBody)
      || classifyAdministrativeText(normalizedBody) !== 'ADMINISTRATIVE'
    ) {
      return getAdministrativeFallbackResponse(language, 'OUT_OF_SCOPE');
    }
    return { body: normalizedBody, metadata };
  }
}
