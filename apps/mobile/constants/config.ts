export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Reserved for future vertical-specific builds. Currently unused — Sawa is
 * single-tenant (family-consulting) and uses plain i18n keys from
 * `i18n/{ar,en}.json` for all UI strings. Kept exported to avoid breaking any
 * downstream tooling; do not introduce runtime vertical switching.
 */
export const VERTICAL_SLUG =
  process.env.EXPO_PUBLIC_VERTICAL_SLUG ?? 'family-consulting';

export const APP_NAME = 'سواء للإرشاد الأسري';
export const APP_SCHEME = 'sawa';

export const DEFAULT_LANGUAGE = 'ar';
export const SUPPORTED_LANGUAGES = ['ar', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://sawa.sa/privacy';
