import { I18nManager } from 'react-native';

export const isRTL = I18nManager.isRTL;

export function rtlStyle<T extends object>(ltrStyle: T, rtlStyle: Partial<T>): T {
  return isRTL ? { ...ltrStyle, ...rtlStyle } : ltrStyle;
}

export const textAlign = isRTL ? 'right' : 'left' as const;
export const flexDirection = isRTL ? 'row-reverse' : 'row' as const;
export const alignSelf = isRTL ? 'flex-end' : 'flex-start' as const;
