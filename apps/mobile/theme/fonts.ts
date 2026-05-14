/**
 * Font name resolver for the Sawaa app.
 *
 * Family: "The Year of Handicrafts" (custom Arabic typeface, design-system aligned).
 * The web design tokens reference IBM Plex Sans Arabic; the native app substitutes
 * Handicrafts so the brand voice stays consistent on RN. If/when IBM Plex Sans Arabic
 * is added as a bundled font, swap the family in `weightMap` below — the public
 * `getFontName(locale, weight)` API stays the same.
 *
 * Weight coverage (assets shipped under apps/mobile/assets/fonts/):
 *   - 400 Regular    → TheYearofHandicraftsTTF-Reg.ttf
 *   - 500 Medium     → TheYearofHandicraftsTTF-Med.ttf
 *   - 600 SemiBold   → TheYearofHandicraftsTTF-SemBd.ttf
 *   - 700 Bold       → TheYearofHandicraftsTTF-Bold.ttf
 *   - 900 Black      → TheYearofHandicraftsTTF-Black.ttf
 *
 * 300 Light: NOT shipped — Handicrafts has no Light cut. We currently fall back to
 * Regular for `'300'`. If a Light asset is added later, drop it in `assets/fonts/`,
 * register it via `fontAssets`, and update `weightMap['300']` to point at the new
 * family name.
 */

export const fontAssets = {
  Handicrafts_400Regular: require('../assets/fonts/TheYearofHandicraftsTTF-Reg.ttf'),
  Handicrafts_500Medium: require('../assets/fonts/TheYearofHandicraftsTTF-Med.ttf'),
  Handicrafts_600SemiBold: require('../assets/fonts/TheYearofHandicraftsTTF-SemBd.ttf'),
  Handicrafts_700Bold: require('../assets/fonts/TheYearofHandicraftsTTF-Bold.ttf'),
  Handicrafts_900Black: require('../assets/fonts/TheYearofHandicraftsTTF-Black.ttf'),
};

type Weight = '300' | '400' | '500' | '600' | '700' | '900';

const weightMap: Record<Weight, string> = {
  // Light asset not bundled → degrade to Regular. Consumers pair 300 with smaller
  // sizes (timestamps, captions) so the visual difference reads anyway.
  '300': 'Handicrafts_400Regular',
  '400': 'Handicrafts_400Regular',
  '500': 'Handicrafts_500Medium',
  '600': 'Handicrafts_600SemiBold',
  '700': 'Handicrafts_700Bold',
  '900': 'Handicrafts_900Black',
};

export function getFontName(_language: string, weight: string = '400'): string {
  const w = (weight in weightMap ? weight : '400') as Weight;
  return weightMap[w];
}

/**
 * Convenience helpers — prefer these over re-typing weight strings at call sites.
 *
 * Usage guidance:
 *   - f300: timestamps, captions, fine print (renders as Regular — see top note)
 *   - f400: body copy, default
 *   - f500: subtitles, secondary text, list metadata
 *   - f600: emphasized labels, button text
 *   - f700: headings, primary CTAs
 */
export const f300 = (locale: string = 'ar'): string => getFontName(locale, '300');
export const f400 = (locale: string = 'ar'): string => getFontName(locale, '400');
export const f500 = (locale: string = 'ar'): string => getFontName(locale, '500');
export const f600 = (locale: string = 'ar'): string => getFontName(locale, '600');
export const f700 = (locale: string = 'ar'): string => getFontName(locale, '700');
