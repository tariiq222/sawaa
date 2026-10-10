import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Trash2 } from 'lucide-react-native';

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ scheme: mockScheme, theme: require('@/theme/tokens').buildTheme(null, mockScheme) }),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));

import { getSawaaColors } from '@/theme/sawaa/tokens';
import { MenuGroup } from '../MenuGroup';
import { ConfirmSheet } from '../ConfirmSheet';

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(hex: string) {
  const channels = rgb(hex).map((value) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function composite(tint: string, base: string) {
  const alpha = parseInt(tint.slice(7, 9), 16) / 255;
  const behind = rgb(base);
  return '#' + rgb(tint).map((value, i) => Math.round(value * alpha + behind[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

it.each(['light', 'dark'] as const)('keeps destructive menu text and its icon readable in %s', (scheme) => {
  mockScheme = scheme;
  const screen = render(<MenuGroup entries={[{ key: 'delete', icon: Trash2, label: 'حذف الحساب', danger: true, onPress: jest.fn() }]} />);
  const background = getSawaaColors(scheme).glass.opaqueBg;
  expect(contrast(StyleSheet.flatten(screen.getByText('حذف الحساب').props.style).color, background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(screen.UNSAFE_getByType(Trash2).props.color, background)).toBeGreaterThanOrEqual(3);
});

it.each(['light', 'dark'] as const)('keeps the destructive confirmation glyph readable on its tinted circle in %s', (scheme) => {
  mockScheme = scheme;
  const screen = render(<ConfirmSheet visible icon={Trash2} title="حذف الحساب" body="تأكيد الحذف" confirmLabel="حذف" cancelLabel="إلغاء" onConfirm={jest.fn()} onCancel={jest.fn()} />);
  const glyph = screen.UNSAFE_getByType(Trash2);
  const circle = StyleSheet.flatten(glyph.parent!.props.style).backgroundColor;
  expect(contrast(glyph.props.color, composite(circle, getSawaaColors(scheme).glass.opaqueBg))).toBeGreaterThanOrEqual(3);
});
