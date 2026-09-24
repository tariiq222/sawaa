import type { TextStyle } from 'react-native';

// Bundled locally; rendering waits for these assets in RootLayout.
export const fontAssets = {
  IBMPlexSansArabic_300Light: require('@expo-google-fonts/ibm-plex-sans-arabic/300Light/IBMPlexSansArabic_300Light.ttf'),
  IBMPlexSansArabic_400Regular: require('@expo-google-fonts/ibm-plex-sans-arabic/400Regular/IBMPlexSansArabic_400Regular.ttf'),
  IBMPlexSansArabic_500Medium: require('@expo-google-fonts/ibm-plex-sans-arabic/500Medium/IBMPlexSansArabic_500Medium.ttf'),
  IBMPlexSansArabic_600SemiBold: require('@expo-google-fonts/ibm-plex-sans-arabic/600SemiBold/IBMPlexSansArabic_600SemiBold.ttf'),
  IBMPlexSansArabic_700Bold: require('@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf'),
};

const weightMap: Record<string, keyof typeof fontAssets> = {
  '300': 'IBMPlexSansArabic_300Light',
  '400': 'IBMPlexSansArabic_400Regular',
  '500': 'IBMPlexSansArabic_500Medium',
  '600': 'IBMPlexSansArabic_600SemiBold',
  '700': 'IBMPlexSansArabic_700Bold',
  // IBM Arabic's heaviest available cut is Bold.
  '900': 'IBMPlexSansArabic_700Bold',
  bold: 'IBMPlexSansArabic_700Bold',
  normal: 'IBMPlexSansArabic_400Regular',
};

export function getFontName(_language: string, weight: string = '400'): string {
  return weightMap[weight] ?? weightMap['400'];
}

export function getHeadingFont(weight: '600' | '700' | '900' = '700'): string {
  return getFontName('ar', weight);
}

// Each registered font family already encodes its weight.
export function fontWeightFor(_weight: string): TextStyle['fontWeight'] | undefined {
  return undefined;
}

export const f300 = (locale = 'ar'): string => getFontName(locale, '300');
export const f400 = (locale = 'ar'): string => getFontName(locale, '400');
export const f500 = (locale = 'ar'): string => getFontName(locale, '500');
export const f600 = (locale = 'ar'): string => getFontName(locale, '600');
export const f700 = (locale = 'ar'): string => getFontName(locale, '700');
export const f900 = (locale = 'ar'): string => getFontName(locale, '900');
