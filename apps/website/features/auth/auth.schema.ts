/**
 * Same `string | null` contract as `validateSaudiPhone`: the returned string
 * is an i18n key — callers must render it through `useT()`/`t(locale, key)`.
 * Mirrors the backend password policy (min 8, >=1 uppercase, >=1 digit).
 */
export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'auth.password.tooShort';
  }
  if (!/[A-Z]/.test(password)) {
    return 'auth.password.needUppercase';
  }
  if (!/[0-9]/.test(password)) {
    return 'auth.password.needDigit';
  }
  return null;
}

/**
 * Same `string | null` contract as `validateSaudiPhone`: the returned string
 * is an i18n key — callers must render it through `useT()`/`t(locale, key)`.
 */
export function validateEmail(email: string): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'auth.invalidEmail';
  }
  return null;
}

/**
 * Normalize a Saudi mobile number to E.164 (`+9665XXXXXXXX`).
 *
 * Accepted input forms (spaces/dashes tolerated anywhere):
 *   05XXXXXXXX · 5XXXXXXXX · +9665XXXXXXXX · 9665XXXXXXXX · 009665XXXXXXXX
 *
 * Returns `null` when the input is not a valid Saudi mobile number.
 */
export function normalizeSaudiPhone(input: string): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[\s-]/g, '');
  if (/^\+9665\d{8}$/.test(cleaned)) return cleaned;
  if (/^9665\d{8}$/.test(cleaned)) return `+${cleaned}`;
  if (/^009665\d{8}$/.test(cleaned)) return `+${cleaned.slice(2)}`;
  if (/^05\d{8}$/.test(cleaned)) return `+966${cleaned.slice(1)}`;
  if (/^5\d{8}$/.test(cleaned)) return `+966${cleaned}`;
  return null;
}

/**
 * Same `string | null` contract as the validators above, but the returned
 * string is an i18n key — callers must render it through `useT()`.
 */
export function validateSaudiPhone(input: string): string | null {
  return normalizeSaudiPhone(input) === null ? 'auth.invalidPhone' : null;
}
