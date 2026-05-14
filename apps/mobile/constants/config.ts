export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * The tenant this binary is locked to. Defaults to dev DEFAULT_ORGANIZATION_ID.
 * Override per-environment via EXPO_PUBLIC_TENANT_ID. Sent as the X-Org-Id
 * header on every API call by services/api.ts.
 */
export const TENANT_ID =
  process.env.EXPO_PUBLIC_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';

/**
 * Vertical slug for the locked tenant. Drives `useTerminology()` so that
 * vertical-specific wording (e.g. "Consultants" vs "Therapists" vs "Doctors")
 * resolves from the shared terminology pack instead of being hardcoded in
 * `i18n/{ar,en}.json`. Override per-environment via EXPO_PUBLIC_VERTICAL_SLUG.
 *
 * Default `family-consulting` matches Sawaa's primary tenant and the seed
 * row in `prisma/migrations/20260422080855_saas_03_verticals_seed_data`.
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
