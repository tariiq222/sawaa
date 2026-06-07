export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * Default organization id for this single-organization build.
 * Prefer EXPO_PUBLIC_ORGANIZATION_ID; EXPO_PUBLIC_TENANT_ID remains as a
 * deprecated fallback for existing mobile environments.
 */
export const DEFAULT_ORGANIZATION_ID =
  process.env.EXPO_PUBLIC_ORGANIZATION_ID ??
  process.env.EXPO_PUBLIC_TENANT_ID ??
  '00000000-0000-0000-0000-000000000001';

/** @deprecated Use DEFAULT_ORGANIZATION_ID. */
export const TENANT_ID = DEFAULT_ORGANIZATION_ID;

/**
 * Vertical slug for the default organization. Drives `useTerminology()` so that
 * vertical-specific wording (e.g. "Consultants" vs "Therapists" vs "Doctors")
 * resolves from the shared terminology pack instead of being hardcoded in
 * `i18n/{ar,en}.json`. Override per-environment via EXPO_PUBLIC_VERTICAL_SLUG.
 *
 * Default `family-consulting` matches Sawaa's primary organization and the seed
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
