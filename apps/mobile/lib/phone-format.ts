import { SAUDI_PHONE_REGEX } from '@sawaa/shared/validators/phone';

// Match common local entry forms before submission; the backend remains the
// authority for international numbering-plan validity and canonicalization.
/**
 * Saudi-only entry for the phone-first login flow. Returns the canonical
 * E.164 form (for example +966512345678) or null for anything else — the
 * backend accepts Saudi mobiles only on that route.
 */
export function normalizeSaudiMobile(value: string): string | null {
  let digits = value.trim().replace(/[\s().-]/g, '');
  if (/^009665\d{8}$/.test(digits)) digits = `+${digits.slice(2)}`;
  else if (/^9665\d{8}$/.test(digits)) digits = `+${digits}`;
  else if (/^0?5\d{8}$/.test(digits)) digits = `+966${digits.replace(/^0/, '')}`;
  return SAUDI_PHONE_REGEX.test(digits) ? digits : null;
}

export function hasPhoneFormat(value: string): boolean {
  if (!/^[+\d\s().-]+$/.test(value)) return false;
  let normalized = value.trim().replace(/[\s().-]/g, '').replace(/^00/, '+');
  if (/^0?5\d{8}$/.test(normalized)) {
    return SAUDI_PHONE_REGEX.test(`+966${normalized.replace(/^0/, '')}`);
  }
  if (/^966\d+$/.test(normalized)) normalized = `+${normalized}`;
  // Local Saudi fixed numbers are also accepted by the server normalizer.
  if (/^0?1\d{8}$/.test(normalized)) normalized = `+966${normalized.replace(/^0/, '')}`;
  if (normalized.startsWith('+9665')) return SAUDI_PHONE_REGEX.test(normalized);
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}
