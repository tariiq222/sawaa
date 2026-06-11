/**
 * Font name resolver for the Sawaa app.
 *
 * Typography split:
 *   - Headings (display, heading, subheading) → "The Year of Handicrafts" brand typeface.
 *   - Body copy (body, caption, label, timestamps, inputs) → system font (SF / SF Arabic
 *     on iOS; Roboto on Android). Pair system-font usages with an explicit `fontWeight`
 *     style so weight emphasis survives — the system font encodes weight via `fontWeight`,
 *     not by family name.
 *
 * Handicrafts weight coverage (assets under apps/mobile/assets/fonts/):
 *   - 400 Regular    → TheYearofHandicraftsTTF-Reg.ttf
 *   - 500 Medium     → TheYearofHandicraftsTTF-Med.ttf
 *   - 600 SemiBold   → TheYearofHandicraftsTTF-SemBd.ttf
 *   - 700 Bold       → TheYearofHandicraftsTTF-Bold.ttf
 *   - 900 Black      → TheYearofHandicraftsTTF-Black.ttf
 *
 * `getFontName(locale, weight)` still works as before; callers using weights 300–600
 * will now receive SYSTEM_FONT. Always pair those usages with `fontWeight: 'NNN'` so
 * weight emphasis is preserved on both platforms.
 */

import { Platform, type TextStyle } from 'react-native';

/** System font family — resolves to SF (SF Arabic for ar) on iOS, Roboto on Android. */
export const SYSTEM_FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;

export const fontAssets = {
  Handicrafts_400Regular: require('../assets/fonts/TheYearofHandicraftsTTF-Reg.ttf'),
  Handicrafts_500Medium: require('../assets/fonts/TheYearofHandicraftsTTF-Med.ttf'),
  Handicrafts_600SemiBold: require('../assets/fonts/TheYearofHandicraftsTTF-SemBd.ttf'),
  Handicrafts_700Bold: require('../assets/fonts/TheYearofHandicraftsTTF-Bold.ttf'),
  Handicrafts_900Black: require('../assets/fonts/TheYearofHandicraftsTTF-Black.ttf'),
};

type Weight = '300' | '400' | '500' | '600' | '700' | '900';

const weightMap: Record<Weight, string> = {
  // Body weights → system font. Consumers must pair with `fontWeight: 'NNN'` so
  // weight emphasis survives (the system font selects weight via fontWeight, not family).
  '300': SYSTEM_FONT,
  '400': SYSTEM_FONT,
  '500': SYSTEM_FONT,
  '600': SYSTEM_FONT,
  // Heading weights → brand Handicrafts typeface.
  '700': 'Handicrafts_700Bold',
  '900': 'Handicrafts_900Black',
};

export function getFontName(_language: string, weight: string = '400'): string {
  const w = (weight in weightMap ? weight : '400') as Weight;
  return weightMap[w];
}

/** Brand (heading) font regardless of weight split — for display text. */
export function getHeadingFont(weight: '600' | '700' | '900' = '700'): string {
  return weight === '900' ? 'Handicrafts_900Black' : weight === '600' ? 'Handicrafts_600SemiBold' : 'Handicrafts_700Bold';
}

/** System fonts encode weight via fontWeight, not family name. Pair with fNNN(). */
export function fontWeightFor(weight: string): TextStyle['fontWeight'] | undefined {
  return weight === '300' || weight === '400' || weight === '500' || weight === '600'
    ? (weight as TextStyle['fontWeight'])
    : undefined;
}

/**
 * Convenience helpers — prefer these over re-typing weight strings at call sites.
 *
 * Usage guidance:
 *   - f300: timestamps, captions, fine print → system font; pair with fontWeight: '300'
 *   - f400: body copy, default → system font; pair with fontWeight: '400'
 *   - f500: subtitles, secondary text, list metadata → system font; pair with fontWeight: '500'
 *   - f600: emphasized labels, button text → system font; pair with fontWeight: '600'
 *   - f700: headings, primary CTAs → Handicrafts Bold (brand)
 *   - f900: display/black → Handicrafts Black (brand)
 */
export const f300 = (locale: string = 'ar'): string => getFontName(locale, '300');
export const f400 = (locale: string = 'ar'): string => getFontName(locale, '400');
export const f500 = (locale: string = 'ar'): string => getFontName(locale, '500');
export const f600 = (locale: string = 'ar'): string => getFontName(locale, '600');
export const f700 = (locale: string = 'ar'): string => getFontName(locale, '700');
export const f900 = (locale: string = 'ar'): string => getFontName(locale, '900');
