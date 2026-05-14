import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export type AuthChannel = 'SMS' | 'EMAIL';

const DEFAULT_PHONE_REGION: CountryCode = 'SA';

export function detectChannel(value: string): AuthChannel {
  if (!value || !value.trim()) {
    throw new Error('Invalid identifier');
  }
  return value.includes('@') ? 'EMAIL' : 'SMS';
}

/**
 * Normalize a phone number to E.164 (`+<country><subscriber>`).
 *
 * Accepts common Saudi-flavored variants and any international form
 * libphonenumber-js can parse:
 *   `+966512345678`, `00966512345678`, `966512345678`,
 *   `0512345678` (local SA), `+1 (415) 555-0100`, …
 *
 * Throws `BadRequestException('invalid_phone')` on anything that does not
 * parse to a valid number under `defaultRegion` (default Saudi Arabia).
 */
export function normalizePhone(
  value: string,
  defaultRegion: CountryCode = DEFAULT_PHONE_REGION,
): string {
  if (!value || typeof value !== 'string') {
    throw new BadRequestException('invalid_phone');
  }
  let trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException('invalid_phone');
  }
  // Accept the international-trunk prefix `00` (e.g. `00966...`) by rewriting
  // it to `+`, since libphonenumber-js does not treat `00` as a `+` synonym
  // when a default region is supplied.
  if (trimmed.startsWith('00')) {
    trimmed = `+${trimmed.slice(2)}`;
  }
  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion);
  if (!parsed || !parsed.isValid()) {
    throw new BadRequestException('invalid_phone');
  }
  return parsed.number;
}

export function normalizeIdentifier(value: string, channel: AuthChannel): string {
  if (channel === 'EMAIL') return value.trim().toLowerCase();
  return normalizePhone(value);
}
