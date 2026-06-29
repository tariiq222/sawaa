import type { Locale } from './locale';

/**
 * Pick the Arabic display value when the UI is Arabic, falling back to the
 * default (English) field when the Arabic one is missing. The backend returns
 * `serviceNameAr`/`employeeNameAr`/`branchNameAr` alongside the base names;
 * components should never bind the base field unconditionally on an Arabic page.
 */
export function localizedName(
  locale: Locale,
  fallback: string,
  ar: string | null | undefined,
): string {
  return locale === 'ar' ? ar?.trim() || fallback : fallback;
}
